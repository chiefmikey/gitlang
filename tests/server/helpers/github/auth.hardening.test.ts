import { beforeEach,describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use the modules
// ---------------------------------------------------------------------------
const mockSend = vi.hoisted(() => vi.fn());

// Each call to the installation auth will return a token with a future expiry
// by default; individual tests override this per-case.
const mockInstallationAuth = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    token: 'ghs_hardening',
  }),
);

const mockCreateAppAuth = vi.hoisted(() =>
  vi.fn(() => mockInstallationAuth),
);

// Use a class (not an arrow) so SecretsManagerClient stays constructable via
// `new` in auth.ts AND lint-stable — eslint/prettier autofix rewrites
// `vi.fn(function(){})` into a non-constructable arrow, which breaks `new`.
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  GetSecretValueCommand: vi.fn(),
  SecretsManagerClient: class {
    send = mockSend;
  },
}));

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: mockCreateAppAuth,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub all three env-var credentials so getCredentials() resolves from env. */
const stubEnvironmentCredentials = () => {
  vi.stubEnv('GH_APP_ID', 'app-123');
  vi.stubEnv('GH_INSTALLATION_ID', 'install-456');
  vi.stubEnv(
    'GH_PRIVATE_KEY',
    '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
  );
};

/** Valid AWS secret payload. */
const awsSecretPayload = JSON.stringify({
  APP_ID: 'aws-app-id',
  INSTALLATION_ID: 'aws-install-id',
  PRIVATE_KEY:
    '-----BEGIN RSA PRIVATE KEY-----\naws\n-----END RSA PRIVATE KEY-----',
});

// ---------------------------------------------------------------------------
// Reset state between tests — must vi.resetModules() so module-level globals
// (cachedToken, inFlightToken, etc.) are fresh for every test.
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  mockInstallationAuth.mockResolvedValue({
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    token: 'ghs_hardening',
  });
  mockCreateAppAuth.mockReturnValue(mockInstallationAuth);
});

// ---------------------------------------------------------------------------
// Finding 1: In-flight dedup — thundering-herd prevention
// ---------------------------------------------------------------------------
describe('auth — in-flight token dedup (finding 1)', () => {
  it('concurrent auth() calls trigger only ONE token generation', async () => {
    stubEnvironmentCredentials();

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    // Fire three concurrent calls while the token cache is cold.
    const [t1, t2, t3] = await Promise.all([auth(), auth(), auth()]);

    // All three resolve to the same token.
    expect(t1).toBe('ghs_hardening');
    expect(t2).toBe('ghs_hardening');
    expect(t3).toBe('ghs_hardening');

    // createAppAuth (and its returned fn) called exactly once — no thundering herd.
    expect(mockInstallationAuth).toHaveBeenCalledTimes(1);
  });

  it('a second concurrent call gets the in-flight result, not a new one', async () => {
    stubEnvironmentCredentials();

    // Return different tokens on successive calls to detect double-firing.
    mockInstallationAuth
      .mockResolvedValueOnce({
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        token: 'ghs_first',
      })
      .mockResolvedValueOnce({
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        token: 'ghs_second',
      });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const [t1, t2] = await Promise.all([auth(), auth()]);

    // Both should resolve to the first token — the second call rode the in-flight promise.
    expect(t1).toBe('ghs_first');
    expect(t2).toBe('ghs_first');
    expect(mockInstallationAuth).toHaveBeenCalledTimes(1);
  });

  it('after in-flight resolves, a subsequent call uses the cache', async () => {
    stubEnvironmentCredentials();

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    await auth(); // warms the cache
    await auth(); // should hit cache, NOT call installationAuth again

    expect(mockInstallationAuth).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Finding 1 (credentials): AWS fetch dedup
// ---------------------------------------------------------------------------
describe('auth — credentials in-flight dedup (finding 1, AWS path)', () => {
  it('concurrent auth() calls on a cold AWS path trigger only ONE AWS fetch', async () => {
    // No env vars set — forces AWS path.
    mockSend.mockResolvedValue({ SecretString: awsSecretPayload });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const [t1, t2, t3] = await Promise.all([auth(), auth(), auth()]);

    expect(t1).toBe('ghs_hardening');
    expect(t2).toBe('ghs_hardening');
    expect(t3).toBe('ghs_hardening');

    // AWS send() called only once despite three concurrent callers.
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Finding 2: NaN / invalid-expiry guard
// ---------------------------------------------------------------------------
describe('auth — NaN/invalid expiry guard (finding 2)', () => {
  it('when expiresAt is undefined the service still returns a token', async () => {
    stubEnvironmentCredentials();
    mockInstallationAuth.mockResolvedValueOnce({
      // expiresAt deliberately omitted — octokit types allow undefined
      expiresAt: undefined as unknown as string,
      token: 'ghs_noexpiry',
    });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();

    expect(token).toBe('ghs_noexpiry');
  });

  it('when expiresAt is a non-date string the service still returns a token', async () => {
    stubEnvironmentCredentials();
    mockInstallationAuth.mockResolvedValueOnce({
      expiresAt: 'not-a-date',
      token: 'ghs_baddate',
    });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();

    expect(token).toBe('ghs_baddate');
  });

  it('logs a structured bad_expiry error when expiresAt is unparseable', async () => {
    stubEnvironmentCredentials();
    mockInstallationAuth.mockResolvedValueOnce({
      expiresAt: 'INVALID',
      token: 'ghs_baddate_log',
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    await auth();

    const logged = spy.mock.calls.some((arguments_) => {
      try {
        const parsed = JSON.parse(arguments_[0] as string) as Record<string, unknown>;
        return (
          parsed.event === 'auth_failure' && parsed.reason === 'bad_expiry'
        );
      } catch {
        return false;
      }
    });

    expect(logged).toBe(true);

    spy.mockRestore();
  });

  it('falls back to a conservative TTL on bad expiry (token not expired immediately)', async () => {
    stubEnvironmentCredentials();
    mockInstallationAuth.mockResolvedValueOnce({
      expiresAt: 'INVALID',
      token: 'ghs_conserve',
    });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const before = Date.now();
    const token = await auth();

    expect(token).toBe('ghs_conserve');

    // Call again — should hit cache (not regenerate), proving the fallback TTL
    // placed expiry in the future rather than at/before now.
    const token2 = await auth();

    expect(token2).toBe('ghs_conserve');
    expect(mockInstallationAuth).toHaveBeenCalledTimes(1);

    void before; // suppress unused-var lint
  });
});

// ---------------------------------------------------------------------------
// Finding 3: Structured failure logging
// ---------------------------------------------------------------------------
describe('auth — structured failure logging (finding 3)', () => {
  it('logs auth_failure/credentials_missing when no env vars and AWS returns nothing', async () => {
    mockSend.mockResolvedValue({ SecretString: undefined });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();

    expect(token).toBe('');

    const logged = spy.mock.calls.some((arguments_) => {
      try {
        const parsed = JSON.parse(arguments_[0] as string) as Record<string, unknown>;
        return (
          parsed.event === 'auth_failure' &&
          parsed.reason === 'credentials_missing'
        );
      } catch {
        return false;
      }
    });

    expect(logged).toBe(true);

    spy.mockRestore();
  });

  it('logs auth_failure/aws_fetch_error when AWS throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('AWS network error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    await auth();

    const logged = spy.mock.calls.some((arguments_) => {
      try {
        const parsed = JSON.parse(arguments_[0] as string) as Record<string, unknown>;
        return (
          parsed.event === 'auth_failure' &&
          parsed.reason === 'aws_fetch_error'
        );
      } catch {
        return false;
      }
    });

    expect(logged).toBe(true);

    spy.mockRestore();
  });

  it('logs auth_failure/token_generation_error when createAppAuth throws', async () => {
    stubEnvironmentCredentials();
    mockInstallationAuth.mockRejectedValueOnce(new Error('octokit exploded'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();

    expect(token).toBe('');

    const logged = spy.mock.calls.some((arguments_) => {
      try {
        const parsed = JSON.parse(arguments_[0] as string) as Record<string, unknown>;
        return (
          parsed.event === 'auth_failure' &&
          parsed.reason === 'token_generation_error'
        );
      } catch {
        return false;
      }
    });

    expect(logged).toBe(true);

    spy.mockRestore();
  });

  it('structured logs include an error field with the error message', async () => {
    stubEnvironmentCredentials();
    const errorMessage = 'private key parse failed';
    mockInstallationAuth.mockRejectedValueOnce(new Error(errorMessage));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    await auth();

    const matched = spy.mock.calls.some((arguments_) => {
      try {
        const parsed = JSON.parse(arguments_[0] as string) as Record<string, unknown>;
        return (
          parsed.event === 'auth_failure' &&
          typeof parsed.error === 'string' &&
          (parsed.error).includes(errorMessage)
        );
      } catch {
        return false;
      }
    });

    expect(matched).toBe(true);

    spy.mockRestore();
  });
});

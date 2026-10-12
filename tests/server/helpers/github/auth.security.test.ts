import { beforeEach, describe, expect, it, vi } from 'vitest';

// Security / failure-mode regression tests for server/helpers/github/auth.ts.
// Mocks that are instantiated with `new` MUST be classes (see CLAUDE.md).
const mockSend = vi.hoisted(() => vi.fn());
const mockInstallationAuth = vi.hoisted(() => vi.fn());
const mockCreateAppAuth = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  GetSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
  SecretsManagerClient: class {
    send = mockSend;
  },
}));

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: mockCreateAppAuth,
}));

const PEM =
  '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAsupersecretkeymaterial\n-----END RSA PRIVATE KEY-----';

const futureExpiry = (ms = 3_600_000): string =>
  new Date(Date.now() + ms).toISOString();

const awsSecret = (overrides: Record<string, unknown> = {}) => ({
  SecretString: JSON.stringify({
    APP_ID: 'aws-app',
    INSTALLATION_ID: 'aws-install',
    PRIVATE_KEY: PEM,
    ...overrides,
  }),
});

const loadAuth = async () =>
  (await import('../../../../server/helpers/github/auth')).default;

/** Everything written through console.error, joined, for leak assertions. */
const captureLogs = () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return {
    text: () => spy.mock.calls.map((c) => c.map(String).join(' ')).join('\n'),
  };
};

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  mockSend.mockReset();
  mockInstallationAuth.mockReset();
  mockCreateAppAuth.mockReset();
  mockInstallationAuth.mockImplementation(async () => ({
    expiresAt: futureExpiry(),
    token: 'ghs_ok',
  }));
  mockCreateAppAuth.mockImplementation(() => mockInstallationAuth);
});

describe('auth security: secret leakage into logs', () => {
  it('does not echo a non-JSON secret payload into the logs (JSON.parse snippet)', async () => {
    const logs = captureLogs();
    mockSend.mockResolvedValue({ SecretString: 'hunter2-raw-secret-value' });

    const auth = await loadAuth();
    expect(await auth()).toBe('');

    expect(logs.text()).not.toContain('hunter2-raw-secret-value');
    // Still diagnosable: the failure is logged with a distinct reason.
    expect(logs.text()).toContain('secret_parse_error');
  });

  it('redacts token and private-key material from logged error messages', async () => {
    const logs = captureLogs();
    vi.stubEnv('GH_APP_ID', '1');
    vi.stubEnv('GH_INSTALLATION_ID', '2');
    vi.stubEnv('GH_PRIVATE_KEY', PEM);
    mockInstallationAuth.mockRejectedValue(
      new Error(
        `request failed: Authorization: bearer ghs_ABCDEF1234567890abcdef1234567890ABCD key=${PEM} jwt=eyJhbGciOiJSUzI1NiJ9.eyJpYXQiOjF9.c2lnbmF0dXJl`,
      ),
    );

    const auth = await loadAuth();
    expect(await auth()).toBe('');

    const text = logs.text();
    expect(text).not.toContain('ghs_ABCDEF1234567890abcdef1234567890ABCD');
    expect(text).not.toContain('supersecretkeymaterial');
    expect(text).not.toContain('eyJhbGciOiJSUzI1NiJ9');
    expect(text).toContain('token_generation_error');
  });

  it('never logs the minted token on the success path', async () => {
    const logs = captureLogs();
    vi.stubEnv('GH_APP_ID', '1');
    vi.stubEnv('GH_INSTALLATION_ID', '2');
    vi.stubEnv('GH_PRIVATE_KEY', PEM);
    mockInstallationAuth.mockResolvedValue({
      expiresAt: 'garbage',
      token: 'ghs_SUCCESSTOKEN',
    });

    const auth = await loadAuth();
    await auth();

    expect(logs.text()).not.toContain('ghs_SUCCESSTOKEN');
  });
});

describe('auth security: credential validation', () => {
  it('treats empty env credentials as unset and falls back to AWS', async () => {
    vi.stubEnv('GH_APP_ID', '');
    vi.stubEnv('GH_INSTALLATION_ID', '');
    vi.stubEnv('GH_PRIVATE_KEY', '');
    mockSend.mockResolvedValue(awsSecret());

    const auth = await loadAuth();
    expect(await auth()).toBe('ghs_ok');

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockCreateAppAuth).toHaveBeenCalledWith(
      expect.objectContaining({ appId: 'aws-app', privateKey: PEM }),
    );
  });

  it('rejects an AWS secret whose fields are empty or whitespace', async () => {
    captureLogs();
    mockSend.mockResolvedValue(awsSecret({ PRIVATE_KEY: '   ' }));

    const auth = await loadAuth();
    expect(await auth()).toBe('');
    expect(mockCreateAppAuth).not.toHaveBeenCalled();
  });
});

describe('auth security: empty / invalid token propagation', () => {
  it.each([
    ['undefined', undefined],
    ['empty string', ''],
    ['non-string', 42],
  ])('does not cache or return a %s token', async (_name, badToken) => {
    const logs = captureLogs();
    vi.stubEnv('GH_APP_ID', '1');
    vi.stubEnv('GH_INSTALLATION_ID', '2');
    vi.stubEnv('GH_PRIVATE_KEY', PEM);
    mockInstallationAuth.mockResolvedValueOnce({
      expiresAt: futureExpiry(),
      token: badToken,
    });

    const auth = await loadAuth();
    expect(await auth()).toBe('');
    expect(logs.text()).toContain('token_generation_error');

    // Not poisoned: the next call mints again and succeeds.
    expect(await auth()).toBe('ghs_ok');
    expect(mockInstallationAuth).toHaveBeenCalledTimes(2);
  });
});

describe('auth security: stale credential cache', () => {
  it('refetches rotated Secrets Manager credentials after a mint failure', async () => {
    captureLogs();
    mockSend
      .mockResolvedValueOnce(awsSecret({ PRIVATE_KEY: 'old-key' }))
      .mockResolvedValueOnce(awsSecret({ PRIVATE_KEY: 'new-key' }));
    mockInstallationAuth.mockRejectedValueOnce(new Error('Bad credentials'));

    const auth = await loadAuth();
    expect(await auth()).toBe('');
    expect(await auth()).toBe('ghs_ok');

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockCreateAppAuth).toHaveBeenLastCalledWith(
      expect.objectContaining({ privateKey: 'new-key' }),
    );
  });
});

describe('auth security: hung dependencies must not wedge the in-flight guards', () => {
  it('a hung Secrets Manager call times out and a later call recovers', async () => {
    vi.useFakeTimers();
    captureLogs();
    mockSend.mockImplementationOnce(() => new Promise(() => {}));
    mockSend.mockResolvedValue(awsSecret());

    const auth = await loadAuth();
    const first = auth();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await first).toBe('');

    expect(await auth()).toBe('ghs_ok');
  });

  it('a hung token mint times out and a later call recovers', async () => {
    vi.useFakeTimers();
    captureLogs();
    vi.stubEnv('GH_APP_ID', '1');
    vi.stubEnv('GH_INSTALLATION_ID', '2');
    vi.stubEnv('GH_PRIVATE_KEY', PEM);
    mockInstallationAuth.mockImplementationOnce(() => new Promise(() => {}));

    const auth = await loadAuth();
    const first = auth();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await first).toBe('');

    expect(await auth()).toBe('ghs_ok');
  });
});

describe('auth security: token freshness', () => {
  it('asks octokit to refresh (bypass its 59-minute internal cache) when re-minting', async () => {
    vi.stubEnv('GH_APP_ID', '1');
    vi.stubEnv('GH_INSTALLATION_ID', '2');
    vi.stubEnv('GH_PRIVATE_KEY', PEM);

    const auth = await loadAuth();
    await auth();

    expect(mockInstallationAuth).toHaveBeenCalledWith(
      expect.objectContaining({ refresh: true, type: 'installation' }),
    );
  });
});

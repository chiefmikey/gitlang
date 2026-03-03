import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.hoisted(() => vi.fn());
const mockInstallationAuth = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    token: 'ghs_test123',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  }),
);
const mockCreateAppAuth = vi.hoisted(() =>
  vi.fn(() => mockInstallationAuth),
);

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn(function () {
    return { send: mockSend };
  }),
  GetSecretValueCommand: vi.fn(function (args: unknown) {
    return args;
  }),
}));

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: mockCreateAppAuth,
}));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  // Re-wire mockInstallationAuth after clearAllMocks resets the resolved value
  mockInstallationAuth.mockResolvedValue({
    token: 'ghs_test123',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  mockCreateAppAuth.mockReturnValue(mockInstallationAuth);
});

describe('auth', () => {
  it('returns token from env vars when all three are set', async () => {
    vi.stubEnv('GH_APP_ID', '12345');
    vi.stubEnv('GH_INSTALLATION_ID', '67890');
    vi.stubEnv(
      'GH_PRIVATE_KEY',
      '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
    );

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();
    expect(token).toBe('ghs_test123');
  });

  it('falls back to AWS Secrets Manager when env vars are missing', async () => {
    mockSend.mockResolvedValue({
      SecretString: JSON.stringify({
        APP_ID: 'aws-app-id',
        INSTALLATION_ID: 'aws-install-id',
        PRIVATE_KEY:
          '-----BEGIN RSA PRIVATE KEY-----\naws\n-----END RSA PRIVATE KEY-----',
      }),
    });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();
    expect(token).toBe('ghs_test123');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns empty string when no credentials are available', async () => {
    mockSend.mockResolvedValue({ SecretString: undefined });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();
    expect(token).toBe('');
  });

  it('returns empty string when AWS secret is malformed JSON', async () => {
    mockSend.mockResolvedValue({ SecretString: 'not-valid-json{{{' });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();
    expect(token).toBe('');
  });

  it('returns empty string when AWS secret JSON is missing required fields', async () => {
    mockSend.mockResolvedValue({
      SecretString: JSON.stringify({ SOME_OTHER_KEY: 'value' }),
    });

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    const token = await auth();
    expect(token).toBe('');
  });

  it('caches token and only calls createAppAuth once for two auth() calls', async () => {
    vi.stubEnv('GH_APP_ID', '12345');
    vi.stubEnv('GH_INSTALLATION_ID', '67890');
    vi.stubEnv(
      'GH_PRIVATE_KEY',
      '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
    );

    const { default: auth } = await import(
      '../../../../server/helpers/github/auth'
    );

    await auth();
    await auth();

    expect(mockCreateAppAuth).toHaveBeenCalledTimes(1);
  });
});

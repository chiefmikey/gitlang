import { generateKeyPairSync } from 'node:crypto';

import { request } from '@octokit/request';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercises auth.ts against the REAL @octokit/auth-app (only the HTTP layer is
// faked) to prove the 5-minute early-refresh margin is honoured even though
// octokit keeps its own installation-token cache for 59 minutes.
const { fakeFetch } = vi.hoisted(() => ({ fakeFetch: vi.fn() }));

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  GetSecretValueCommand: class {},
  SecretsManagerClient: class {
    send = vi.fn();
  },
}));

vi.mock('@octokit/auth-app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@octokit/auth-app')>();
  return {
    createAppAuth: (options: Parameters<typeof actual.createAppAuth>[0]) =>
      actual.createAppAuth({
        ...options,
        request: request.defaults({ request: { fetch: fakeFetch } }),
      } as Parameters<typeof actual.createAppAuth>[0]),
  };
});

const MINUTE = 60_000;

describe('auth against real @octokit/auth-app', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { format: 'pem', type: 'pkcs1' },
      publicKeyEncoding: { format: 'pem', type: 'spki' },
    });
    vi.stubEnv('GH_APP_ID', '1');
    vi.stubEnv('GH_INSTALLATION_ID', '2');
    vi.stubEnv('GH_PRIVATE_KEY', privateKey);

    let count = 0;
    fakeFetch.mockReset();
    fakeFetch.mockImplementation(async () => {
      count += 1;
      return new Response(
        JSON.stringify({
          expires_at: new Date(Date.now() + 60 * MINUTE).toISOString(),
          permissions: {},
          repository_selection: 'all',
          token: `ghs_token_${count}`,
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 201,
        },
      );
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('never hands out a token with less than 5 minutes of life left', async () => {
    const { default: auth } =
      await import('../../../../server/helpers/github/auth');

    expect(await auth()).toBe('ghs_token_1');

    // 56 minutes later our margin has elapsed but octokit's own cache
    // (59 min) would still serve the same token with ~4 minutes left.
    vi.setSystemTime(new Date(Date.now() + 56 * MINUTE));
    const token = await auth();

    expect(token).toBe('ghs_token_2');
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });
});

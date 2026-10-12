import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const net = vi.hoisted(() => ({
  fetch: undefined as undefined | ((url: string) => Promise<Response>),
}));

vi.mock('@octokit/rest', async () => {
  const actual =
    await vi.importActual<typeof import('@octokit/rest')>('@octokit/rest');
  return {
    Octokit: class extends actual.Octokit {
      constructor(options: Record<string, unknown>) {
        super({ ...options, request: { fetch: net.fetch } });
      }
    },
  };
});

import rateLimit from '../../../../server/helpers/github/rateLimit';

const TOKEN = 'ghs_SUPERSECRETTOKEN';

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('rateLimit hardening', () => {
  it('returns the core rate for a healthy response (real Octokit pipeline)', async () => {
    net.fetch = async () =>
      jsonResponse(200, {
        rate: { limit: 5000, remaining: 12, reset: 1_700_000_000, used: 4988 },
        resources: {},
      });

    expect(await rateLimit(TOKEN)).toEqual({
      limit: 5000,
      remaining: 12,
      reset: 1_700_000_000,
      used: 4988,
    });
  });

  it('returns undefined (never throws) on upstream failure and logs no secrets or dumps', async () => {
    net.fetch = async () => jsonResponse(401, { message: 'Bad credentials' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await rateLimit(TOKEN)).toBeUndefined();

    const logged = JSON.stringify(
      errorSpy.mock.calls.map((call) => call.map(String)),
    );
    expect(logged).not.toContain('SUPERSECRETTOKEN');
    for (const call of errorSpy.mock.calls) {
      for (const argument of call) {
        expect(typeof argument).toBe('string');
      }
    }
  });

  it('returns undefined on a malformed 200 body instead of an object of undefineds', async () => {
    net.fetch = async () => jsonResponse(200, { resources: {} });

    expect(await rateLimit(TOKEN)).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Real Octokit + real pagination plugin; only the network layer is faked.
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

import repositories, {
  isOrganization,
  parseOrgName,
} from '../../../../server/helpers/github/repositories';
import {
  GitHubRateLimitError,
  MAX_REPO_PAGES,
} from '../../../../server/helpers/github/githubSafety';

const TOKEN = 'ghs_SUPERSECRETTOKEN';

const jsonResponse = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  });

const page = (pageNumber: number, hasNext: boolean): Response =>
  jsonResponse(
    200,
    Array.from({ length: 100 }, (_, index) => ({
      fork: false,
      name: `r${String(pageNumber)}-${String(index)}`,
    })),
    hasNext
      ? {
          link: `<https://api.github.com/users/octo/repos?page=${String(pageNumber + 1)}>; rel="next"`,
        }
      : {},
  );

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('repositories hardening', () => {
  it('bounds pagination (was: followed every page of a huge account)', async () => {
    let calls = 0;
    net.fetch = async () => {
      calls += 1;
      // A pathological account with 150 pages; terminate the stream there.
      return page(calls, calls < 150);
    };

    const result = await repositories('octo', TOKEN);

    expect(calls).toBeLessThanOrEqual(MAX_REPO_PAGES);
    expect(result).toHaveLength(MAX_REPO_PAGES * 100);
  });

  it('bounds pagination for organizations too', async () => {
    let calls = 0;
    net.fetch = async () => {
      calls += 1;
      return page(calls, calls < 150);
    };

    await repositories('@bigorg', TOKEN);

    expect(calls).toBeLessThanOrEqual(MAX_REPO_PAGES);
  });

  it('still returns every repo when the account is under the cap', async () => {
    let calls = 0;
    net.fetch = async () => {
      calls += 1;
      return page(calls, calls < 3);
    };

    const result = await repositories('octo', TOKEN);

    expect(calls).toBe(3);
    expect(result).toHaveLength(300);
  });

  it('filters forks unless includeForks is set', async () => {
    net.fetch = async () =>
      jsonResponse(200, [
        { fork: true, name: 'forked' },
        { fork: false, name: 'own' },
      ]);

    expect(await repositories('octo', TOKEN)).toEqual(['own']);
    expect(await repositories('octo', TOKEN, true)).toEqual(['forked', 'own']);
  });

  it('throws a typed rate-limit error (was: [] -> handler 404 "not found")', async () => {
    net.fetch = async () =>
      jsonResponse(
        403,
        { message: 'API rate limit exceeded' },
        { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
      );

    const error = await repositories('octo', TOKEN).catch(
      (error_: unknown) => error_,
    );

    expect(error).toBeInstanceOf(GitHubRateLimitError);
    expect((error as GitHubRateLimitError).reset).toBe(1_700_000_000);
  });

  it('throws on a rate limit hit mid-pagination instead of returning a partial list', async () => {
    let calls = 0;
    net.fetch = async () => {
      calls += 1;
      return calls === 1
        ? page(1, true)
        : jsonResponse(429, { message: 'slow down' }, { 'retry-after': '10' });
    };

    await expect(repositories('octo', TOKEN)).rejects.toBeInstanceOf(
      GitHubRateLimitError,
    );
  });

  it('returns [] for a genuinely unknown user (404)', async () => {
    net.fetch = async () => jsonResponse(404, { message: 'Not Found' });

    expect(await repositories('nobody-here', TOKEN)).toEqual([]);
    expect(await repositories('@nobody-here', TOKEN)).toEqual([]);
  });

  it('returns [] for a non-rate-limit 403 / 451 (inaccessible, not an outage)', async () => {
    net.fetch = async () => jsonResponse(403, { message: 'SAML enforcement' });
    expect(await repositories('octo', TOKEN)).toEqual([]);
    net.fetch = async () => jsonResponse(451, { message: 'blocked' });
    expect(await repositories('octo', TOKEN)).toEqual([]);
  });

  it('rethrows 5xx instead of reporting "user not found" (was: [])', async () => {
    net.fetch = async () => jsonResponse(503, { message: 'Unavailable' });

    await expect(repositories('octo', TOKEN)).rejects.toMatchObject({
      status: 503,
    });
  });

  it('rethrows network failures', async () => {
    net.fetch = async () => {
      throw new TypeError('fetch failed');
    };

    await expect(repositories('octo', TOKEN)).rejects.toBeDefined();
  });

  it('never sends path-like or empty names to GitHub (was: GET /repos, /orgs//repos)', async () => {
    const urls: string[] = [];
    net.fetch = async (url) => {
      urls.push(url);
      return jsonResponse(200, [{ fork: false, name: 'x' }]);
    };

    const inputs = [
      '..',
      '.',
      '@',
      'org:',
      'org/',
      '@..',
      'org:../x',
      '@a/b',
      'a/b',
      ' torvalds',
      'torvalds ',
      '',
      'x'.repeat(40),
    ];
    for (const input of inputs) {
      expect(await repositories(input, TOKEN)).toEqual([]);
    }
    expect(urls).toEqual([]);
  });

  it('still routes valid user and org inputs', async () => {
    const urls: string[] = [];
    net.fetch = async (url) => {
      urls.push(url);
      return jsonResponse(200, [{ fork: false, name: 'x' }]);
    };

    await repositories('octo-cat', TOKEN);
    await repositories('@my-org', TOKEN);
    await repositories('org:my_org', TOKEN);

    expect(urls[0]).toContain('/users/octo-cat/repos');
    expect(urls[1]).toContain('/orgs/my-org/repos');
    expect(urls[2]).toContain('/orgs/my_org/repos');
  });

  it('does not log the token or request dumps', async () => {
    net.fetch = async () => jsonResponse(503, { message: 'Unavailable' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await repositories('octo', TOKEN).catch(() => {});

    expect(errorSpy).toHaveBeenCalled();

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
});

describe('isOrganization / parseOrgName edge cases', () => {
  it('flags bare prefixes as organizations with an empty name', () => {
    expect(isOrganization('@')).toBe(true);
    expect(parseOrgName('@')).toBe('');
    expect(isOrganization('org:')).toBe(true);
    expect(parseOrgName('org:')).toBe('');
    expect(parseOrgName('org/')).toBe('');
  });

  it('does not treat a user named like a prefix as an org', () => {
    expect(isOrganization('organization')).toBe(false);
    expect(isOrganization('org')).toBe(false);
  });
});

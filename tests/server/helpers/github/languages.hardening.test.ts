import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from 'vitest';

// Real Octokit (real request pipeline, real error objects) with only the
// network layer faked, so these tests observe true GitHub-facing behavior.
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

import languages from '../../../../server/helpers/github/languages';
import { GitHubRateLimitError } from '../../../../server/helpers/github/githubSafety';

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

const rateLimited = (): Response =>
  jsonResponse(
    403,
    { message: 'API rate limit exceeded' },
    { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
  );

const names = (n: number): string[] =>
  Array.from({ length: n }, (_, index) => `repo${String(index)}`);

let errorSpy: MockInstance<typeof console.error>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('languages hardening', () => {
  it('caps concurrent GitHub calls (was: one in-flight call per repo)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    net.fetch = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => {
        setTimeout(resolve, 2);
      });
      inFlight -= 1;
      return jsonResponse(200, { TypeScript: 1 });
    };

    const result = await languages('octo', names(120), TOKEN);

    expect(result).toHaveLength(120);
    expect(maxInFlight).toBeLessThanOrEqual(10);
  });

  it('preserves input order under the concurrency cap', async () => {
    net.fetch = async (url) => {
      const index = Number(/repo(\d+)\/languages/.exec(url)?.[1]);
      // Later repos answer faster than earlier ones.
      await new Promise((resolve) => {
        setTimeout(resolve, 30 - (index % 30));
      });
      return jsonResponse(200, { [`L${String(index)}`]: index });
    };

    const result = await languages('octo', names(40), TOKEN);

    expect(result).toEqual(
      names(40).map((_, index) => ({ [`L${String(index)}`]: index })),
    );
  });

  it('throws a typed rate-limit error instead of returning {} for a 403 rate limit', async () => {
    net.fetch = async () => rateLimited();

    const error = await languages('octo', ['a', 'b'], TOKEN).catch(
      (error_: unknown) => error_,
    );

    expect(error).toBeInstanceOf(GitHubRateLimitError);
    expect((error as GitHubRateLimitError).status).toBe(403);
    expect((error as GitHubRateLimitError).reset).toBe(1_700_000_000);
  });

  it('treats a 429 as a rate limit', async () => {
    net.fetch = async () =>
      jsonResponse(429, { message: 'slow down' }, { 'retry-after': '60' });

    const error = await languages('octo', ['a'], TOKEN).catch(
      (error_: unknown) => error_,
    );

    expect(error).toBeInstanceOf(GitHubRateLimitError);
    expect((error as GitHubRateLimitError).retryAfter).toBe(60);
  });

  it('treats a 403 secondary rate limit (retry-after, remaining > 0) as a rate limit', async () => {
    net.fetch = async () =>
      jsonResponse(
        403,
        { message: 'You have exceeded a secondary rate limit.' },
        { 'retry-after': '30', 'x-ratelimit-remaining': '4000' },
      );

    await expect(languages('octo', ['a'], TOKEN)).rejects.toBeInstanceOf(
      GitHubRateLimitError,
    );
  });

  it('stops issuing further calls once rate limited (was: all N calls still sent)', async () => {
    let calls = 0;
    net.fetch = async () => {
      calls += 1;
      return rateLimited();
    };

    await expect(languages('octo', names(200), TOKEN)).rejects.toBeInstanceOf(
      GitHubRateLimitError,
    );
    expect(calls).toBeLessThanOrEqual(10);
  });

  it('still maps a genuinely missing repo (404) to {} while other repos succeed', async () => {
    net.fetch = async (url) =>
      url.includes('/gone/')
        ? jsonResponse(404, { message: 'Not Found' })
        : jsonResponse(200, { Go: 7 });

    const result = await languages('octo', ['a', 'gone', 'c'], TOKEN);

    expect(result).toEqual([{ Go: 7 }, {}, { Go: 7 }]);
  });

  it('maps blocked repos (451) and non-rate-limit 403 to {}', async () => {
    net.fetch = async (url) =>
      url.includes('/dmca/')
        ? jsonResponse(451, { message: 'Repository access blocked' })
        : jsonResponse(403, { message: 'Resource not accessible' });

    const result = await languages('octo', ['dmca', 'other'], TOKEN);

    expect(result).toEqual([{}, {}]);
  });

  it('rethrows upstream failures (5xx) instead of presenting them as no languages', async () => {
    net.fetch = async (url) =>
      url.includes('/bad/')
        ? jsonResponse(502, { message: 'Bad Gateway' })
        : jsonResponse(200, { Go: 1 });

    await expect(
      languages('octo', ['ok', 'bad', 'ok2'], TOKEN),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('rethrows network failures', async () => {
    net.fetch = async () => {
      throw new TypeError('fetch failed');
    };

    await expect(languages('octo', ['a'], TOKEN)).rejects.toBeDefined();
  });

  it('never lets owner/repo path segments escape the endpoint (was: GET /languages)', async () => {
    const urls: string[] = [];
    net.fetch = async (url) => {
      urls.push(url);
      return jsonResponse(200, { Go: 1 });
    };

    const traversal = await languages('..', ['..'], TOKEN);
    const badRepo = await languages(
      'octo',
      ['..', '.', 'a/b', '', 'x y'],
      TOKEN,
    );

    expect(traversal).toEqual([{}]);
    expect(badRepo).toEqual([{}, {}, {}, {}, {}]);
    expect(urls).toEqual([]);
  });

  it('rejects an owner that is not a GitHub login without calling GitHub', async () => {
    const urls: string[] = [];
    net.fetch = async (url) => {
      urls.push(url);
      return jsonResponse(200, {});
    };

    for (const owner of [
      '',
      '@octo',
      'org:octo',
      'a/b',
      ' octo',
      'x'.repeat(40),
    ]) {
      expect(await languages(owner, ['r'], TOKEN)).toEqual([{}]);
    }
    expect(urls).toEqual([]);
  });

  it('accepts valid logins and repo names (dots, dashes, underscores)', async () => {
    const urls: string[] = [];
    net.fetch = async (url) => {
      urls.push(url);
      return jsonResponse(200, { Go: 1 });
    };

    await languages('octo-cat_1', ['my.repo-name_2', '.github'], TOKEN);

    expect(urls).toHaveLength(2);
  });

  it('refuses an unbounded repo list (was: N repos -> N GitHub calls)', async () => {
    let calls = 0;
    net.fetch = async () => {
      calls += 1;
      return jsonResponse(200, {});
    };

    await expect(languages('octo', names(5000), TOKEN)).rejects.toBeInstanceOf(
      RangeError,
    );
    expect(calls).toBe(0);
  });

  it('does not log the token or full request/response dumps', async () => {
    net.fetch = async () => jsonResponse(502, { message: 'Bad Gateway' });

    await languages('octo', ['broken'], TOKEN).catch(() => {});

    expect(errorSpy).toHaveBeenCalled();

    const logged = JSON.stringify(
      errorSpy.mock.calls.map((call) => call.map(String)),
    );
    expect(logged).not.toContain('SUPERSECRETTOKEN');
    expect(logged).not.toContain('authorization');
    for (const call of errorSpy.mock.calls) {
      for (const argument of call) {
        expect(typeof argument).toBe('string');
      }
    }
  });
});

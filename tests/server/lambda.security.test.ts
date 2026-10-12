import { beforeEach, describe, expect, it, vi } from 'vitest';

import auth from '../../server/helpers/github/auth';
import {
  getContributorLanguages,
  listContributors,
} from '../../server/helpers/github/contributors';
import { GitHubRateLimitError } from '../../server/helpers/github/githubSafety';
import languages from '../../server/helpers/github/languages';
import fetchMerged from '../../server/helpers/github/merged';
import rateLimit from '../../server/helpers/github/rateLimit';
import repositories from '../../server/helpers/github/repositories';
import { handler } from '../../server/lambda';

vi.mock('../../server/helpers/github/auth', () => ({
  default: vi.fn().mockResolvedValue('ghs_SECRET_TOKEN'),
}));
vi.mock('../../server/helpers/github/repositories', () => ({
  default: vi.fn().mockResolvedValue(['repo1']),
}));
vi.mock('../../server/helpers/github/languages', () => ({
  default: vi.fn().mockResolvedValue([{ TypeScript: 1 }]),
}));
vi.mock('../../server/helpers/github/merged', () => ({
  default: vi.fn().mockResolvedValue({ langs: [{ TypeScript: 1 }], repos: ['r'] }),
}));
vi.mock('../../server/helpers/github/rateLimit', () => ({
  default: vi
    .fn()
    .mockResolvedValue({ limit: 5000, remaining: 4999, reset: 1, used: 1 }),
}));
vi.mock('../../server/helpers/github/contributors', () => ({
  getContributorLanguages: vi.fn().mockResolvedValue({ TypeScript: 1 }),
  listContributors: vi
    .fn()
    .mockResolvedValue([{ avatar_url: '', contributions: 1, login: 'u' }]),
}));

const asMock = (function_: unknown): ReturnType<typeof vi.fn> =>
  function_ as ReturnType<typeof vi.fn>;

const makeEvent = (
  path: string,
  parameters?: Record<string, string>,
  extra: Record<string, unknown> = {},
): any => ({
  queryStringParameters: parameters ?? {},
  rawPath: `/gitlang/github${path}`,
  ...extra,
});

const body = (response: any): any => JSON.parse(response.body as string);

beforeEach(() => {
  vi.clearAllMocks();
  asMock(auth).mockResolvedValue('ghs_SECRET_TOKEN');
  asMock(repositories).mockResolvedValue(['repo1']);
  asMock(languages).mockResolvedValue([{ TypeScript: 1 }]);
  asMock(fetchMerged).mockResolvedValue({
    langs: [{ TypeScript: 1 }],
    repos: ['r'],
  });
  asMock(rateLimit).mockResolvedValue({
    limit: 5000,
    remaining: 4999,
    reset: 1,
    used: 1,
  });
  asMock(listContributors).mockResolvedValue([
    { avatar_url: '', contributions: 1, login: 'u' },
  ]);
  asMock(getContributorLanguages).mockResolvedValue({ TypeScript: 1 });
});

const BAD_LOGINS = [
  'a'.repeat(40),
  'has space',
  'semi;colon',
  'new\nline',
  'quote"x',
  '../etc',
  '..',
  '.',
  'a/b',
  'a%2Fb',
  'x'.repeat(5000),
  '{__proto__}',
];

const GOOD_LOGINS = [
  'torvalds',
  'chiefmikey',
  'a-b',
  'A',
  'a'.repeat(39),
  'user_name',
  'octo-cat-1',
];

describe('input validation: username on /repos and /merged', () => {
  for (const bad of BAD_LOGINS) {
    it(`/repos rejects ${JSON.stringify(bad.slice(0, 20))} (len ${bad.length}) with 400`, async () => {
      const response = await handler(makeEvent('/repos', { username: bad }));

      expect(response.statusCode).toBe(400);
      expect(repositories).not.toHaveBeenCalled();
    });

    it(`/merged rejects ${JSON.stringify(bad.slice(0, 20))} (len ${bad.length}) with 400`, async () => {
      const response = await handler(makeEvent('/merged', { username: bad }));

      expect(response.statusCode).toBe(400);
      expect(fetchMerged).not.toHaveBeenCalled();
    });
  }

  for (const good of GOOD_LOGINS) {
    for (const form of [good, `@${good}`, `org:${good}`, `org/${good}`]) {
      it(`/merged accepts ${form}`, async () => {
        const response = await handler(makeEvent('/merged', { username: form }));

        expect(response.statusCode).toBe(200);
        expect(fetchMerged).toHaveBeenCalledWith(form, 'ghs_SECRET_TOKEN');
      });
    }
  }

  for (const bare of ['@', 'org:', 'org/', '@@x', 'org:org:x']) {
    it(`/merged rejects prefix-only or double-prefixed ${bare}`, async () => {
      const response = await handler(makeEvent('/merged', { username: bare }));

      expect(response.statusCode).toBe(400);
    });
  }
});

describe('input validation: owner / repo / author', () => {
  for (const bad of BAD_LOGINS) {
    it(`/contributors rejects owner ${JSON.stringify(bad.slice(0, 20))} (len ${bad.length})`, async () => {
      const response = await handler(
        makeEvent('/contributors', { owner: bad, repo: 'r' }),
      );

      expect(response.statusCode).toBe(400);
      expect(listContributors).not.toHaveBeenCalled();
    });

    it(`/langs rejects owner ${JSON.stringify(bad.slice(0, 20))} (len ${bad.length})`, async () => {
      const response = await handler(
        makeEvent('/langs', { owner: bad, repos: '["r"]' }),
      );

      expect(response.statusCode).toBe(400);
      expect(languages).not.toHaveBeenCalled();
    });
  }

  it('owner with an org prefix is not valid for owner-style routes', async () => {
    const response = await handler(
      makeEvent('/contributors', { owner: '@org', repo: 'r' }),
    );

    expect(response.statusCode).toBe(400);
  });

  const BAD_REPOS = [
    '..',
    '.',
    'a/b',
    'a b',
    'x'.repeat(101),
    'semi;colon',
    'a%2Fb',
    '..%2F..',
    'new\nline',
  ];
  for (const bad of BAD_REPOS) {
    it(`/contributors rejects repo ${JSON.stringify(bad.slice(0, 20))}`, async () => {
      const response = await handler(
        makeEvent('/contributors', { owner: 'o', repo: bad }),
      );

      expect(response.statusCode).toBe(400);
      expect(listContributors).not.toHaveBeenCalled();
    });

    it(`/contributor-langs rejects repo ${JSON.stringify(bad.slice(0, 20))}`, async () => {
      const response = await handler(
        makeEvent('/contributor-langs', { author: 'a', owner: 'o', repo: bad }),
      );

      expect(response.statusCode).toBe(400);
      expect(getContributorLanguages).not.toHaveBeenCalled();
    });

    it(`/langs rejects repos array element ${JSON.stringify(bad.slice(0, 20))}`, async () => {
      const response = await handler(
        makeEvent('/langs', { owner: 'o', repos: JSON.stringify(['ok', bad]) }),
      );

      expect(response.statusCode).toBe(400);
      expect(languages).not.toHaveBeenCalled();
    });
  }

  for (const good of ['.github', 'my.repo_x-y', 'repo1', 'a'.repeat(100)]) {
    it(`accepts legitimate repo name ${good.slice(0, 12)}`, async () => {
      const response = await handler(
        makeEvent('/contributors', { owner: 'o', repo: good }),
      );

      // "..." is a legal GitHub repo name only as a normal path segment
      expect(response.statusCode).toBe(200);
    });
  }

  const BAD_AUTHORS = [
    'x'.repeat(300),
    'a b',
    'a&per_page=1000',
    'new\nline',
    'a/b',
    'semi;colon',
    '<script>',
  ];
  for (const bad of BAD_AUTHORS) {
    it(`/contributor-langs rejects author ${JSON.stringify(bad.slice(0, 20))}`, async () => {
      const response = await handler(
        makeEvent('/contributor-langs', { author: bad, owner: 'o', repo: 'r' }),
      );

      expect(response.statusCode).toBe(400);
      expect(getContributorLanguages).not.toHaveBeenCalled();
    });
  }

  for (const good of ['torvalds', 'dependabot[bot]', 'a-b', 'user_name']) {
    it(`/contributor-langs accepts author ${good}`, async () => {
      const response = await handler(
        makeEvent('/contributor-langs', { author: good, owner: 'o', repo: 'r' }),
      );

      expect(response.statusCode).toBe(200);
    });
  }
});

describe('/langs repos array bounds', () => {
  it('rejects arrays larger than the fan-out cap before touching GitHub', async () => {
    const repos = Array.from({ length: 101 }, (_, index) => `r${index}`);
    const response = await handler(
      makeEvent('/langs', { owner: 'o', repos: JSON.stringify(repos) }),
    );

    expect(response.statusCode).toBe(400);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(languages).not.toHaveBeenCalled();
  });

  it('accepts exactly the cap', async () => {
    const repos = Array.from({ length: 100 }, (_, index) => `r${index}`);
    const response = await handler(
      makeEvent('/langs', { owner: 'o', repos: JSON.stringify(repos) }),
    );

    expect(response.statusCode).toBe(200);
    expect(languages).toHaveBeenCalledWith('o', repos, 'ghs_SECRET_TOKEN');
  });

  it('rejects non-string and nested elements', async () => {
    for (const repos of ['[1]', '[["a"]]', '[null]', '[{"a":1}]', '"str"', 'null']) {
      const response = await handler(makeEvent('/langs', { owner: 'o', repos }));

      expect(response.statusCode).toBe(400);
    }

    expect(languages).not.toHaveBeenCalled();
  });

  it('proceeds when rate limit info is unavailable', async () => {
    asMock(rateLimit).mockResolvedValueOnce();
    const response = await handler(
      makeEvent('/langs', { owner: 'o', repos: '["a"]' }),
    );

    expect(response.statusCode).toBe(200);
  });
});

describe('/contributor-langs fan-out guard', () => {
  it('returns 429 without fetching when remaining budget cannot cover one run', async () => {
    asMock(rateLimit).mockResolvedValueOnce({
      limit: 5000,
      remaining: 10,
      reset: 99,
      used: 4990,
    });
    const response = await handler(
      makeEvent('/contributor-langs', { author: 'a', owner: 'o', repo: 'r' }),
    );

    expect(response.statusCode).toBe(429);
    expect(getContributorLanguages).not.toHaveBeenCalled();
  });

  it('proceeds when budget is sufficient', async () => {
    const response = await handler(
      makeEvent('/contributor-langs', { author: 'a', owner: 'o', repo: 'r' }),
    );

    expect(response.statusCode).toBe(200);
  });
});

describe('path handling', () => {
  it('does not treat a mid-path /gitlang/github segment as the prefix', async () => {
    const response = await handler({
      queryStringParameters: { username: 'torvalds' },
      rawPath: '/repos/gitlang/github',
    } as any);

    expect(response.statusCode).toBe(404);
    expect(repositories).not.toHaveBeenCalled();
  });

  it('does not strip a doubled prefix twice', async () => {
    const response = await handler({
      queryStringParameters: { username: 'torvalds' },
      rawPath: '/gitlang/github/gitlang/github/repos',
    } as any);

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 (not a thrown TypeError) when rawPath is undefined', async () => {
    const response = await handler({ queryStringParameters: {} } as any);

    expect(response.statusCode).toBe(404);
  });

  it('still serves unprefixed paths (direct invocation behaviour is unchanged)', async () => {
    const response = await handler({
      queryStringParameters: { username: 'torvalds' },
      rawPath: '/repos',
    } as any);

    expect(response.statusCode).toBe(200);
  });

  it('handles null queryStringParameters', async () => {
    const response = await handler({
      queryStringParameters: null,
      rawPath: '/gitlang/github/repos',
    } as any);

    expect(response.statusCode).toBe(400);
  });
});

describe('HTTP method handling', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    it(`rejects ${method} with 405`, async () => {
      const response = await handler(
        makeEvent(
          '/repos',
          { username: 'torvalds' },
          { requestContext: { http: { method } } },
        ),
      );

      expect(response.statusCode).toBe(405);
      expect(repositories).not.toHaveBeenCalled();
    });
  }

  for (const method of ['GET', 'HEAD']) {
    it(`allows ${method}`, async () => {
      const response = await handler(
        makeEvent(
          '/repos',
          { username: 'torvalds' },
          { requestContext: { http: { method } } },
        ),
      );

      expect(response.statusCode).toBe(200);
    });
  }
});

describe('upstream error classification', () => {
  const rateLimited = (): Error =>
    Object.assign(new Error('API rate limit exceeded for installation'), {
      response: { headers: { 'x-ratelimit-remaining': '0' } },
      status: 403,
    });

  it('maps an upstream 403 rate-limit error from /merged to 429', async () => {
    asMock(fetchMerged).mockRejectedValueOnce(rateLimited());
    const response = await handler(makeEvent('/merged', { username: 'x' }));

    expect(response.statusCode).toBe(429);
  });

  it('maps an upstream 429 error from /merged to 429', async () => {
    asMock(fetchMerged).mockRejectedValueOnce(
      Object.assign(new Error('slow down'), { status: 429 }),
    );
    const response = await handler(makeEvent('/merged', { username: 'x' }));

    expect(response.statusCode).toBe(429);
  });

  it('maps a GraphQL RATE_LIMITED error to 429', async () => {
    asMock(fetchMerged).mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        errors: [{ message: 'API rate limit exceeded', type: 'RATE_LIMITED' }],
      }),
    );
    const response = await handler(makeEvent('/merged', { username: 'x' }));

    expect(response.statusCode).toBe(429);
  });

  it('maps rate-limit errors from contributors routes to 429', async () => {
    asMock(listContributors).mockRejectedValueOnce(rateLimited());
    const first = await handler(
      makeEvent('/contributors', { owner: 'o', repo: 'r' }),
    );

    expect(first.statusCode).toBe(429);

    asMock(getContributorLanguages).mockRejectedValueOnce(rateLimited());
    const second = await handler(
      makeEvent('/contributor-langs', { author: 'a', owner: 'o', repo: 'r' }),
    );

    expect(second.statusCode).toBe(429);
  });

  it('keeps a plain 403 (no rate-limit signal) as a generic 500', async () => {
    asMock(fetchMerged).mockRejectedValueOnce(
      Object.assign(new Error('Resource not accessible'), { status: 403 }),
    );
    const response = await handler(makeEvent('/merged', { username: 'x' }));

    expect(response.statusCode).toBe(500);
  });
});

describe('error and header hygiene', () => {
  it('never reflects upstream error text, stack or token in the response body', async () => {
    asMock(fetchMerged).mockRejectedValueOnce(
      new Error('Bad credentials ghs_SECRET_TOKEN https://api.github.com/x'),
    );
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await handler(makeEvent('/merged', { username: 'x' }));

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('ghs_SECRET_TOKEN');
    expect(response.body).not.toContain('Bad credentials');
    expect(response.body).not.toContain('at ');

    spy.mockRestore();
  });

  it('does not log the token or query string values', async () => {
    asMock(fetchMerged).mockRejectedValueOnce(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handler(makeEvent('/merged', { username: 'hunter2-user' }));
    const logged = JSON.stringify(spy.mock.calls);

    expect(logged).not.toContain('ghs_SECRET_TOKEN');
    expect(logged).not.toContain('hunter2-user');

    spy.mockRestore();
  });

  it('sends X-Content-Type-Options: nosniff on every response', async () => {
    const ok = await handler(makeEvent('/repos', { username: 'torvalds' }));
    const bad = await handler(makeEvent('/repos'));
    const nf = await handler(makeEvent('/nope'));
    for (const response of [ok, bad, nf]) {
      expect((response as any).headers['X-Content-Type-Options']).toBe(
        'nosniff',
      );
      expect((response as any).headers['Content-Type']).toBe(
        'application/json',
      );
    }
  });

  it('marks 429 and 5xx responses as not cacheable', async () => {
    asMock(fetchMerged).mockRejectedValueOnce(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await handler(makeEvent('/merged', { username: 'x' }));
    spy.mockRestore();

    expect((response as any).headers['Cache-Control']).toBe('no-store');
  });
});

describe('GitHubRateLimitError from helpers surfaces as 429', () => {
  it('maps a thrown GitHubRateLimitError (even a bare 403) to 429 with reset and Retry-After', async () => {
    asMock(repositories).mockRejectedValueOnce(
      new GitHubRateLimitError('limit hit', 403, 1_700_000_000, 30),
    );
    const response: any = await handler(
      makeEvent('/repos', { username: 'octocat' }),
    );
    expect(response.statusCode).toBe(429);
    expect(response.headers['Retry-After']).toBe('30');
    expect(body(response)).toMatchObject({ reset: 1_700_000_000 });
    expect(response.body).not.toContain('limit hit');
  });
});

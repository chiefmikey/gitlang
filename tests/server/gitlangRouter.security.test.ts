import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getContributorLanguages,
  listContributors,
} from '../../server/helpers/github/contributors';
import languages from '../../server/helpers/github/languages';
import fetchMerged from '../../server/helpers/github/merged';
import rateLimit from '../../server/helpers/github/rateLimit';
import repositories from '../../server/helpers/github/repositories';
import router from '../../server/requests/gitlangRouter';

vi.mock('../../server/helpers/github/tokenManager', () => ({
  getToken: vi.fn().mockResolvedValue('test-token'),
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

interface MockContext {
  request: { query: Record<string, unknown> };
  response: { body: string; status: number };
}

const makeContext = (query: Record<string, unknown> = {}): MockContext => ({
  request: { query },
  response: { body: '', status: 0 },
});

const getHandler = (path: string) => {
  const layer = router.stack.find(
    (l) => l.path === path && l.methods.includes('GET'),
  );
  if (!layer) {
    throw new Error(`No GET handler for ${path}`);
  }
  return layer.stack.at(-1) as (context: MockContext) => Promise<void>;
};

const asMock = (function_: unknown): ReturnType<typeof vi.fn> =>
  function_ as ReturnType<typeof vi.fn>;

const rateLimitedError = (): Error =>
  Object.assign(new Error('API rate limit exceeded'), {
    response: { headers: { 'x-ratelimit-remaining': '0' } },
    status: 403,
  });

beforeEach(() => {
  vi.clearAllMocks();
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
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('router input validation (mirrors the Lambda handler)', () => {
  const BAD = ['..', 'a/b', 'has space', 'x'.repeat(40), 'a\nb', '', 'a;b'];

  for (const bad of BAD) {
    const label = JSON.stringify(bad.slice(0, 12));

    it(`/repos and /merged reject username ${label}`, async () => {
      for (const route of ['/github/repos', '/github/merged']) {
        const context = makeContext({ username: bad });
        await getHandler(route)(context);

        expect(context.response.status).toBe(400);
      }

      expect(repositories).not.toHaveBeenCalled();
      expect(fetchMerged).not.toHaveBeenCalled();
    });

    it(`/contributors and /contributor-langs reject owner ${label}`, async () => {
      const first = makeContext({ owner: bad, repo: 'r' });
      await getHandler('/github/contributors')(first);
      const second = makeContext({ author: 'a', owner: bad, repo: 'r' });
      await getHandler('/github/contributor-langs')(second);

      expect(first.response.status).toBe(400);
      expect(second.response.status).toBe(400);
      expect(listContributors).not.toHaveBeenCalled();
      expect(getContributorLanguages).not.toHaveBeenCalled();
    });
  }

  it('rejects dot-segment repos on every repo-taking route', async () => {
    for (const repo of ['..', '.']) {
      const a = makeContext({ owner: 'o', repo });
      await getHandler('/github/contributors')(a);
      const b = makeContext({ author: 'a', owner: 'o', repo });
      await getHandler('/github/contributor-langs')(b);
      const c = makeContext({ owner: 'o', repos: JSON.stringify([repo]) });
      await getHandler('/github/langs')(c);

      expect([a, b, c].map((context) => context.response.status)).toEqual([
        400, 400, 400,
      ]);
    }
  });

  it('rejects repeated query parameters (Koa gives an array) with 400, not 500', async () => {
    for (const route of ['/github/repos', '/github/merged']) {
      const context = makeContext({ username: ['a', 'b'] });
      await getHandler(route)(context);

      expect(context.response.status).toBe(400);
    }
    const langs = makeContext({ owner: ['a', 'b'], repos: '["r"]' });
    await getHandler('/github/langs')(langs);

    expect(langs.response.status).toBe(400);
  });

  it('rejects a missing username/owner with 400, not 500', async () => {
    const context = makeContext({});
    await getHandler('/github/merged')(context);

    expect(context.response.status).toBe(400);
  });

  it('rejects a missing or non-string repos param with 400', async () => {
    for (const repos of [undefined, ['["a"]', '["b"]']]) {
      const context = makeContext({ owner: 'o', repos });
      await getHandler('/github/langs')(context);

      expect(context.response.status).toBe(400);
    }
  });

  it('caps the repos array at 100 entries', async () => {
    const tooMany = Array.from({ length: 101 }, (_, index) => `r${index}`);
    const context = makeContext({ owner: 'o', repos: JSON.stringify(tooMany) });
    await getHandler('/github/langs')(context);

    expect(context.response.status).toBe(400);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(languages).not.toHaveBeenCalled();

    const exactly = makeContext({
      owner: 'o',
      repos: JSON.stringify(tooMany.slice(0, 100)),
    });
    await getHandler('/github/langs')(exactly);

    expect(exactly.response.status).toBe(200);
  });

  it('accepts every legitimate username form', async () => {
    for (const username of ['torvalds', '@acme', 'org:acme', 'org/acme']) {
      const context = makeContext({ username });
      await getHandler('/github/merged')(context);

      expect(context.response.status).toBe(200);
      expect(fetchMerged).toHaveBeenLastCalledWith(username, 'test-token');
    }
  });

  it('accepts bot authors', async () => {
    const context = makeContext({ author: 'dependabot[bot]', owner: 'o', repo: 'r' });
    await getHandler('/github/contributor-langs')(context);

    expect(context.response.status).toBe(200);
  });
});

describe('router upstream rate-limit handling', () => {
  it('maps rate-limit errors to 429 on every route', async () => {
    asMock(languages).mockRejectedValueOnce(rateLimitedError());
    const langs = makeContext({ owner: 'o', repos: '["r"]' });
    await getHandler('/github/langs')(langs);

    asMock(repositories).mockRejectedValueOnce(rateLimitedError());
    const repos = makeContext({ username: 'o' });
    await getHandler('/github/repos')(repos);

    asMock(listContributors).mockRejectedValueOnce(rateLimitedError());
    const contributors = makeContext({ owner: 'o', repo: 'r' });
    await getHandler('/github/contributors')(contributors);

    asMock(fetchMerged).mockRejectedValueOnce(rateLimitedError());
    const merged = makeContext({ username: 'o' });
    await getHandler('/github/merged')(merged);

    asMock(getContributorLanguages).mockRejectedValueOnce(rateLimitedError());
    const contribLangs = makeContext({ author: 'a', owner: 'o', repo: 'r' });
    await getHandler('/github/contributor-langs')(contribLangs);

    expect(
      [langs, repos, contributors, merged, contribLangs].map(
        (context) => context.response.status,
      ),
    ).toEqual([429, 429, 429, 429, 429]);
  });

  it('does not reflect upstream error text in the 429 body', async () => {
    asMock(fetchMerged).mockRejectedValueOnce(rateLimitedError());
    const context = makeContext({ username: 'o' });
    await getHandler('/github/merged')(context);

    expect(context.response.body).not.toContain('exceeded');
  });

  it('refuses /contributor-langs when the remaining budget cannot cover a run', async () => {
    asMock(rateLimit).mockResolvedValueOnce({
      limit: 5000,
      remaining: 10,
      reset: 5,
      used: 4990,
    });
    const context = makeContext({ author: 'a', owner: 'o', repo: 'r' });
    await getHandler('/github/contributor-langs')(context);

    expect(context.response.status).toBe(429);
    expect(getContributorLanguages).not.toHaveBeenCalled();
  });
});

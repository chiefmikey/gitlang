import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/helpers/github/tokenManager', () => ({
  getToken: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('../../server/helpers/github/repositories', () => ({
  default: vi.fn().mockResolvedValue(['repo1', 'repo2']),
}));

vi.mock('../../server/helpers/github/languages', () => ({
  default: vi.fn().mockResolvedValue([{ TypeScript: 5000 }]),
}));

vi.mock('../../server/helpers/github/merged', () => ({
  default: vi
    .fn()
    .mockResolvedValue({ repos: ['repo1'], langs: [{ TypeScript: 5000 }] }),
}));

vi.mock('../../server/helpers/github/rateLimit', () => ({
  default: vi.fn().mockResolvedValue({
    limit: 5000,
    remaining: 4999,
    reset: 1_234_567_890,
    used: 1,
  }),
}));

vi.mock('../../server/helpers/github/contributors', () => ({
  listContributors: vi
    .fn()
    .mockResolvedValue([
      { login: 'user', contributions: 10, avatar_url: '' },
    ]),
  getContributorLanguages: vi.fn().mockResolvedValue({ TypeScript: 5000 }),
}));

import router from '../../server/requests/gitlangRouter';
import { getToken } from '../../server/helpers/github/tokenManager';
import repositories from '../../server/helpers/github/repositories';
import languages from '../../server/helpers/github/languages';
import fetchMerged from '../../server/helpers/github/merged';
import rateLimit from '../../server/helpers/github/rateLimit';
import {
  listContributors,
  getContributorLanguages,
} from '../../server/helpers/github/contributors';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

interface MockCtx {
  request: { query: Record<string, string> };
  response: { status: number; body: string };
}

const makeCtx = (query: Record<string, string> = {}): MockCtx => ({
  request: { query },
  response: { status: 0, body: '' },
});

// Layers are registered as /github/<route> because the router prefix is /github
const getHandler = (path: string) => {
  const layer = router.stack.find(
    (l) => l.path === path && l.methods.includes('GET'),
  );
  if (!layer) {
    throw new Error(
      `No GET handler for ${path}. Available: ${router.stack.map((l) => l.path).join(', ')}`,
    );
  }
  return layer.stack[layer.stack.length - 1] as (ctx: MockCtx) => Promise<void>;
};

const parseBody = (ctx: MockCtx): unknown => JSON.parse(ctx.response.body);

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default mock implementations after clearing
  (getToken as ReturnType<typeof vi.fn>).mockResolvedValue('test-token');
  (repositories as ReturnType<typeof vi.fn>).mockResolvedValue([
    'repo1',
    'repo2',
  ]);
  (languages as ReturnType<typeof vi.fn>).mockResolvedValue([
    { TypeScript: 5000 },
  ]);
  (fetchMerged as ReturnType<typeof vi.fn>).mockResolvedValue({
    repos: ['repo1'],
    langs: [{ TypeScript: 5000 }],
  });
  (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({
    limit: 5000,
    remaining: 4999,
    reset: 1_234_567_890,
    used: 1,
  });
  (listContributors as ReturnType<typeof vi.fn>).mockResolvedValue([
    { login: 'user', contributions: 10, avatar_url: '' },
  ]);
  (getContributorLanguages as ReturnType<typeof vi.fn>).mockResolvedValue({
    TypeScript: 5000,
  });
});

// ---------------------------------------------------------------------------
// /rate-limit
// ---------------------------------------------------------------------------
describe('gitlangRouter /rate-limit', () => {
  it('returns 200 with rate limit info', async () => {
    const ctx = makeCtx();
    await getHandler('/github/rate-limit')(ctx);
    expect(ctx.response.status).toBe(200);
    expect(parseBody(ctx)).toMatchObject({
      limit: 5000,
      remaining: 4999,
      reset: 1_234_567_890,
      used: 1,
    });
  });

  it('returns 500 when rateLimit returns undefined', async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const ctx = makeCtx();
    await getHandler('/github/rate-limit')(ctx);
    expect(ctx.response.status).toBe(500);
    expect(parseBody(ctx)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 500 when getToken throws', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('token unavailable'),
    );
    const ctx = makeCtx();
    await getHandler('/github/rate-limit')(ctx);
    expect(ctx.response.status).toBe(500);
    expect(parseBody(ctx)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 500 when rateLimit throws', async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('GitHub API error'),
    );
    const ctx = makeCtx();
    await getHandler('/github/rate-limit')(ctx);
    expect(ctx.response.status).toBe(500);
    expect(parseBody(ctx)).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// /langs
// ---------------------------------------------------------------------------
describe('gitlangRouter /langs', () => {
  it('returns 200 with language data for valid owner and repos', async () => {
    const ctx = makeCtx({
      owner: 'torvalds',
      repos: JSON.stringify(['linux']),
    });
    await getHandler('/github/langs')(ctx);
    expect(ctx.response.status).toBe(200);
    expect(parseBody(ctx)).toEqual([{ TypeScript: 5000 }]);
  });

  it('passes owner, repoList, and token to languages()', async () => {
    const ctx = makeCtx({
      owner: 'torvalds',
      repos: JSON.stringify(['linux', 'subsurface']),
    });
    await getHandler('/github/langs')(ctx);
    expect(languages).toHaveBeenCalledWith(
      'torvalds',
      ['linux', 'subsurface'],
      'test-token',
    );
  });

  it('returns 400 when repos is not valid JSON', async () => {
    const ctx = makeCtx({ owner: 'torvalds', repos: 'not-json' });
    await getHandler('/github/langs')(ctx);
    expect(ctx.response.status).toBe(400);
    expect(parseBody(ctx)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when repos JSON is not an array of strings (object)', async () => {
    const ctx = makeCtx({
      owner: 'torvalds',
      repos: JSON.stringify({ repo: 'linux' }),
    });
    await getHandler('/github/langs')(ctx);
    expect(ctx.response.status).toBe(400);
    expect(parseBody(ctx)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when repos JSON is an array of non-strings', async () => {
    const ctx = makeCtx({
      owner: 'torvalds',
      repos: JSON.stringify([1, 2, 3]),
    });
    await getHandler('/github/langs')(ctx);
    expect(ctx.response.status).toBe(400);
  });

  it('returns 429 when rate limit remaining < number of repos', async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      limit: 5000,
      remaining: 0,
      reset: 1_234_567_890,
      used: 5000,
    });
    const ctx = makeCtx({
      owner: 'torvalds',
      repos: JSON.stringify(['linux', 'subsurface']),
    });
    await getHandler('/github/langs')(ctx);
    expect(ctx.response.status).toBe(429);
    expect(parseBody(ctx)).toMatchObject({
      error: expect.any(String),
      remaining: 0,
      needed: 2,
    });
  });

  it('proceeds (200) at the boundary where remaining === repoList.length', async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      limit: 5000,
      remaining: 1,
      reset: 1_234_567_890,
      used: 4999,
    });
    const ctx = makeCtx({
      owner: 'torvalds',
      repos: JSON.stringify(['linux']),
    });
    await getHandler('/github/langs')(ctx);
    // remaining (1) is NOT < repoList.length (1), so should proceed
    expect(ctx.response.status).toBe(200);
  });

  it('returns 404 (via setResponse) when languages() returns []', async () => {
    (languages as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const ctx = makeCtx({
      owner: 'torvalds',
      repos: JSON.stringify(['linux']),
    });
    await getHandler('/github/langs')(ctx);
    expect(ctx.response.status).toBe(404);
    expect(parseBody(ctx)).toEqual([]);
  });

  it('returns 404 (via setResponse error path) when languages() throws — NOT 500', async () => {
    (languages as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('timeout'),
    );
    const ctx = makeCtx({
      owner: 'torvalds',
      repos: JSON.stringify(['linux']),
    });
    await getHandler('/github/langs')(ctx);
    // gitlangRouter calls setResponse(ctx, []) on error → 404, unlike lambda which returns 500
    expect(ctx.response.status).toBe(404);
    expect(parseBody(ctx)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// /repos
// ---------------------------------------------------------------------------
describe('gitlangRouter /repos', () => {
  it('returns 200 with repos list', async () => {
    const ctx = makeCtx({ username: 'torvalds' });
    await getHandler('/github/repos')(ctx);
    expect(ctx.response.status).toBe(200);
    expect(parseBody(ctx)).toEqual(['repo1', 'repo2']);
  });

  it('passes username, token, and false (normalized) to repositories() when includeForks is absent', async () => {
    const ctx = makeCtx({ username: 'torvalds' });
    await getHandler('/github/repos')(ctx);
    expect(repositories).toHaveBeenCalledWith('torvalds', 'test-token', false);
  });

  it('passes includeForks=true to repositories() when query param is "true"', async () => {
    const ctx = makeCtx({ username: 'torvalds', includeForks: 'true' });
    await getHandler('/github/repos')(ctx);
    expect(repositories).toHaveBeenCalledWith('torvalds', 'test-token', true);
  });

  it('passes includeForks=false to repositories() when query param is any other string', async () => {
    const ctx = makeCtx({ username: 'torvalds', includeForks: 'yes' });
    await getHandler('/github/repos')(ctx);
    expect(repositories).toHaveBeenCalledWith('torvalds', 'test-token', false);
  });

  it('returns 404 when repositories() returns []', async () => {
    (repositories as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const ctx = makeCtx({ username: 'nobody' });
    await getHandler('/github/repos')(ctx);
    expect(ctx.response.status).toBe(404);
    expect(parseBody(ctx)).toEqual([]);
  });

  it('returns 404 (via setResponse error path) when repositories() throws — NOT 500', async () => {
    (repositories as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('GitHub API down'),
    );
    const ctx = makeCtx({ username: 'torvalds' });
    await getHandler('/github/repos')(ctx);
    // gitlangRouter calls setResponse(ctx, []) on error → 404, unlike lambda which returns 500
    expect(ctx.response.status).toBe(404);
    expect(parseBody(ctx)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// /contributors
// ---------------------------------------------------------------------------
describe('gitlangRouter /contributors', () => {
  it('returns 200 with contributors list', async () => {
    const ctx = makeCtx({ owner: 'torvalds', repo: 'linux' });
    await getHandler('/github/contributors')(ctx);
    expect(ctx.response.status).toBe(200);
    expect(parseBody(ctx)).toEqual([
      { login: 'user', contributions: 10, avatar_url: '' },
    ]);
  });

  it('passes owner, repo, and token to listContributors()', async () => {
    const ctx = makeCtx({ owner: 'torvalds', repo: 'linux' });
    await getHandler('/github/contributors')(ctx);
    expect(listContributors).toHaveBeenCalledWith(
      'torvalds',
      'linux',
      'test-token',
    );
  });

  it('returns 404 when listContributors() returns []', async () => {
    (listContributors as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const ctx = makeCtx({ owner: 'torvalds', repo: 'empty-repo' });
    await getHandler('/github/contributors')(ctx);
    expect(ctx.response.status).toBe(404);
    expect(parseBody(ctx)).toEqual([]);
  });

  it('returns 500 when listContributors() throws', async () => {
    (listContributors as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('API error'),
    );
    const ctx = makeCtx({ owner: 'torvalds', repo: 'linux' });
    await getHandler('/github/contributors')(ctx);
    // contributors uses explicit 500 on error, unlike repos/langs which use setResponse([])
    expect(ctx.response.status).toBe(500);
    expect(parseBody(ctx)).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// /merged
// ---------------------------------------------------------------------------
describe('gitlangRouter /merged', () => {
  it('returns 200 with merged data', async () => {
    const ctx = makeCtx({ username: 'torvalds' });
    await getHandler('/github/merged')(ctx);
    expect(ctx.response.status).toBe(200);
    expect(parseBody(ctx)).toMatchObject({
      repos: ['repo1'],
      langs: [{ TypeScript: 5000 }],
    });
  });

  it('passes username and token to fetchMerged()', async () => {
    const ctx = makeCtx({ username: 'torvalds' });
    await getHandler('/github/merged')(ctx);
    expect(fetchMerged).toHaveBeenCalledWith('torvalds', 'test-token');
  });

  it('returns 404 when result.repos.length === 0', async () => {
    (fetchMerged as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      repos: [],
      langs: [],
    });
    const ctx = makeCtx({ username: 'nobody' });
    await getHandler('/github/merged')(ctx);
    expect(ctx.response.status).toBe(404);
    expect(parseBody(ctx)).toEqual({ langs: [], repos: [] });
  });

  it('returns 500 when fetchMerged() throws', async () => {
    (fetchMerged as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error'),
    );
    const ctx = makeCtx({ username: 'torvalds' });
    await getHandler('/github/merged')(ctx);
    expect(ctx.response.status).toBe(500);
    expect(parseBody(ctx)).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// /contributor-langs
// ---------------------------------------------------------------------------
describe('gitlangRouter /contributor-langs', () => {
  it('returns 200 with contributor language data', async () => {
    const ctx = makeCtx({
      author: 'contributor',
      owner: 'torvalds',
      repo: 'linux',
    });
    await getHandler('/github/contributor-langs')(ctx);
    expect(ctx.response.status).toBe(200);
    expect(parseBody(ctx)).toEqual({ TypeScript: 5000 });
  });

  it('passes owner, repo, author, and token to getContributorLanguages()', async () => {
    const ctx = makeCtx({
      author: 'contributor',
      owner: 'torvalds',
      repo: 'linux',
    });
    await getHandler('/github/contributor-langs')(ctx);
    expect(getContributorLanguages).toHaveBeenCalledWith(
      'torvalds',
      'linux',
      'contributor',
      'test-token',
    );
  });

  it('returns 500 when getContributorLanguages() throws', async () => {
    (getContributorLanguages as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('API error'),
    );
    const ctx = makeCtx({
      author: 'contributor',
      owner: 'torvalds',
      repo: 'linux',
    });
    await getHandler('/github/contributor-langs')(ctx);
    expect(ctx.response.status).toBe(500);
    expect(parseBody(ctx)).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// Token propagation
// ---------------------------------------------------------------------------
describe('gitlangRouter token propagation', () => {
  it('passes the token from getToken() to repositories()', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce('custom-token');
    const ctx = makeCtx({ username: 'torvalds' });
    await getHandler('/github/repos')(ctx);
    expect(repositories).toHaveBeenCalledWith(
      'torvalds',
      'custom-token',
      false,
    );
  });

  it('passes the token from getToken() to rateLimit() in /rate-limit', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce('custom-token');
    const ctx = makeCtx();
    await getHandler('/github/rate-limit')(ctx);
    expect(rateLimit).toHaveBeenCalledWith('custom-token');
  });
});

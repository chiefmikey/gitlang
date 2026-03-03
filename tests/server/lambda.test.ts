import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/helpers/github/auth', () => ({
  default: vi.fn().mockResolvedValue('test-token'),
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
    reset: 1234567890,
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

import { handler } from '../../server/lambda';
import auth from '../../server/helpers/github/auth';
import repositories from '../../server/helpers/github/repositories';
import languages from '../../server/helpers/github/languages';
import fetchMerged from '../../server/helpers/github/merged';
import rateLimit from '../../server/helpers/github/rateLimit';
import {
  listContributors,
  getContributorLanguages,
} from '../../server/helpers/github/contributors';

const makeEvent = (path: string, params?: Record<string, string>) =>
  ({
    rawPath: `/gitlang/github${path}`,
    queryStringParameters: params ?? {},
  }) as any;

const parseBody = (response: any) => JSON.parse(response.body as string);

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default mock implementations after clearing
  (auth as ReturnType<typeof vi.fn>).mockResolvedValue('test-token');
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
    reset: 1234567890,
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
// /repos
// ---------------------------------------------------------------------------
describe('handler /repos', () => {
  it('returns 200 with repos list when username is provided', async () => {
    const response = await handler(
      makeEvent('/repos', { username: 'torvalds' }),
    );
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual(['repo1', 'repo2']);
  });

  it('returns 400 when username is missing', async () => {
    const response = await handler(makeEvent('/repos'));
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when username is an empty string', async () => {
    const response = await handler(makeEvent('/repos', { username: '' }));
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when repositories returns an empty array', async () => {
    (repositories as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const response = await handler(
      makeEvent('/repos', { username: 'nobody' }),
    );
    expect(response.statusCode).toBe(404);
    expect(parseBody(response)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// /langs
// ---------------------------------------------------------------------------
describe('handler /langs', () => {
  it('returns 200 with language data when owner and repos are valid', async () => {
    const response = await handler(
      makeEvent('/langs', {
        owner: 'user',
        repos: JSON.stringify(['repo1']),
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual([{ TypeScript: 5000 }]);
  });

  it('returns 400 when owner is missing', async () => {
    const response = await handler(
      makeEvent('/langs', { repos: JSON.stringify(['repo1']) }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when repos is missing', async () => {
    const response = await handler(
      makeEvent('/langs', { owner: 'user' }),
    );
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when repos is not valid JSON', async () => {
    const response = await handler(
      makeEvent('/langs', { owner: 'user', repos: 'not-json' }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when repos is valid JSON but not an array of strings', async () => {
    const response = await handler(
      makeEvent('/langs', {
        owner: 'user',
        repos: JSON.stringify({ repo: 'repo1' }),
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it('returns 429 when rate limit remaining is less than the number of repos requested', async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      limit: 5000,
      remaining: 0,
      reset: 1234567890,
      used: 5000,
    });
    const response = await handler(
      makeEvent('/langs', {
        owner: 'user',
        repos: JSON.stringify(['repo1', 'repo2']),
      }),
    );
    expect(response.statusCode).toBe(429);
    const body = parseBody(response);
    expect(body).toMatchObject({
      error: expect.any(String),
      remaining: 0,
    });
  });

  it('proceeds normally when remaining equals the number of repos (boundary)', async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      limit: 5000,
      remaining: 1,
      reset: 1234567890,
      used: 4999,
    });
    const response = await handler(
      makeEvent('/langs', {
        owner: 'user',
        repos: JSON.stringify(['repo1']),
      }),
    );
    // remaining (1) is NOT < repoList.length (1), so it should proceed
    expect(response.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// /merged
// ---------------------------------------------------------------------------
describe('handler /merged', () => {
  it('returns 200 with merged data when username is provided', async () => {
    const response = await handler(
      makeEvent('/merged', { username: 'torvalds' }),
    );
    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body).toMatchObject({ repos: ['repo1'], langs: [{ TypeScript: 5000 }] });
  });

  it('returns 400 when username is missing', async () => {
    const response = await handler(makeEvent('/merged'));
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when username is an empty string', async () => {
    const response = await handler(makeEvent('/merged', { username: '' }));
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when merged result has no repos', async () => {
    (fetchMerged as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      repos: [],
      langs: [],
    });
    const response = await handler(
      makeEvent('/merged', { username: 'nobody' }),
    );
    expect(response.statusCode).toBe(404);
    expect(parseBody(response)).toEqual({ langs: [], repos: [] });
  });
});

// ---------------------------------------------------------------------------
// /rate-limit
// ---------------------------------------------------------------------------
describe('handler /rate-limit', () => {
  it('returns 200 with rate limit info', async () => {
    const response = await handler(makeEvent('/rate-limit'));
    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body).toMatchObject({
      limit: 5000,
      remaining: 4999,
      reset: 1234567890,
      used: 1,
    });
  });

  it('returns 500 when rateLimit returns undefined', async () => {
    (rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    const response = await handler(makeEvent('/rate-limit'));
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// /contributors
// ---------------------------------------------------------------------------
describe('handler /contributors', () => {
  it('returns 200 with contributors list when owner and repo are provided', async () => {
    const response = await handler(
      makeEvent('/contributors', { owner: 'user', repo: 'repo1' }),
    );
    expect(response.statusCode).toBe(200);
    const body = parseBody(response);
    expect(body).toEqual([
      { login: 'user', contributions: 10, avatar_url: '' },
    ]);
  });

  it('returns 400 when owner is missing', async () => {
    const response = await handler(
      makeEvent('/contributors', { repo: 'repo1' }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when repo is missing', async () => {
    const response = await handler(
      makeEvent('/contributors', { owner: 'user' }),
    );
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when both owner and repo are missing', async () => {
    const response = await handler(makeEvent('/contributors'));
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when listContributors returns an empty array', async () => {
    (listContributors as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const response = await handler(
      makeEvent('/contributors', { owner: 'user', repo: 'empty-repo' }),
    );
    expect(response.statusCode).toBe(404);
    expect(parseBody(response)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// /contributor-langs
// ---------------------------------------------------------------------------
describe('handler /contributor-langs', () => {
  it('returns 200 with language data when owner, repo, and author are provided', async () => {
    const response = await handler(
      makeEvent('/contributor-langs', {
        author: 'contributor',
        owner: 'user',
        repo: 'repo1',
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(parseBody(response)).toEqual({ TypeScript: 5000 });
  });

  it('returns 400 when owner is missing', async () => {
    const response = await handler(
      makeEvent('/contributor-langs', {
        author: 'contributor',
        repo: 'repo1',
      }),
    );
    expect(response.statusCode).toBe(400);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when repo is missing', async () => {
    const response = await handler(
      makeEvent('/contributor-langs', {
        author: 'contributor',
        owner: 'user',
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when author is missing', async () => {
    const response = await handler(
      makeEvent('/contributor-langs', {
        owner: 'user',
        repo: 'repo1',
      }),
    );
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when all params are missing', async () => {
    const response = await handler(makeEvent('/contributor-langs'));
    expect(response.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Unknown paths
// ---------------------------------------------------------------------------
describe('handler unknown paths', () => {
  it('returns 404 for an unknown route', async () => {
    const response = await handler(makeEvent('/unknown'));
    expect(response.statusCode).toBe(404);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 404 for the root path', async () => {
    const response = await handler(makeEvent(''));
    expect(response.statusCode).toBe(404);
  });

  it('returns 404 for a partially matching path', async () => {
    const response = await handler(makeEvent('/repo'));
    expect(response.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Auth failures
// ---------------------------------------------------------------------------
describe('handler auth failures', () => {
  it('returns 500 when auth returns an empty token', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce('');
    const response = await handler(
      makeEvent('/repos', { username: 'torvalds' }),
    );
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 500 when auth throws an error', async () => {
    (auth as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Secrets Manager unavailable'),
    );
    const response = await handler(
      makeEvent('/repos', { username: 'torvalds' }),
    );
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------
describe('handler error propagation', () => {
  it('returns 500 when a route handler throws an unexpected error', async () => {
    (repositories as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('GitHub API down'),
    );
    const response = await handler(
      makeEvent('/repos', { username: 'torvalds' }),
    );
    expect(response.statusCode).toBe(500);
    expect(parseBody(response)).toMatchObject({ error: expect.any(String) });
  });

  it('returns 500 when fetchMerged throws an unexpected error', async () => {
    (fetchMerged as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error'),
    );
    const response = await handler(
      makeEvent('/merged', { username: 'torvalds' }),
    );
    expect(response.statusCode).toBe(500);
  });

  it('returns 500 when languages throws an unexpected error', async () => {
    (languages as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Timeout'),
    );
    const response = await handler(
      makeEvent('/langs', {
        owner: 'user',
        repos: JSON.stringify(['repo1']),
      }),
    );
    expect(response.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------
describe('handler response shape', () => {
  it('always sets Content-Type to application/json', async () => {
    const response = await handler(makeEvent('/rate-limit'));
    expect((response as any).headers?.['Content-Type']).toBe(
      'application/json',
    );
  });

  it('always returns a JSON-parseable body string', async () => {
    const response = await handler(
      makeEvent('/repos', { username: 'torvalds' }),
    );
    expect(() => JSON.parse(response.body as string)).not.toThrow();
  });
});

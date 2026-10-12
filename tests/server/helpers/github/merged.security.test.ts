import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGraphql = vi.fn();

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    graphql = mockGraphql;
  },
}));

const page = (
  names: string[],
  next: { hasNextPage: boolean; endCursor: string | null } = {
    endCursor: null,
    hasNextPage: false,
  },
  key: 'organization' | 'user' = 'user',
) => {
  const response: Record<string, unknown> = { organization: null, user: null };
  response[key] = {
    repositories: {
      nodes: names.map((name) => ({
        isFork: false,
        languages: { edges: [{ node: { name: 'TypeScript' }, size: 10 }] },
        name,
      })),
      pageInfo: next,
    },
  };
  return response;
};

// Always claims there is another page, but self-terminates after `limit`
// calls so an unbounded implementation fails the assertion instead of hanging.
const stopAfter = (limit: number, endCursor: string | null): void => {
  let calls = 0;
  mockGraphql.mockImplementation(async () => {
    calls += 1;
    return page(['r'], { endCursor, hasNextPage: calls < limit });
  });
};

const loadFresh = async () => {
  vi.resetModules();
  return import('../../../../server/helpers/github/merged');
};

beforeEach(() => {
  mockGraphql.mockReset();
});

describe('fetchMerged GraphQL construction (injection)', () => {
  it('passes the login only as a GraphQL variable, never in query text', async () => {
    const { default: fetchMerged } = await loadFresh();
    mockGraphql.mockResolvedValue(page(['a']));
    await fetchMerged('torvalds', 'tok');
    const [query, variables] = mockGraphql.mock.calls[0];

    expect(query).not.toContain('torvalds');
    expect(variables.login).toBe('torvalds');
  });

  it('never reaches GraphQL with a login that is not a valid GitHub login', async () => {
    const { default: fetchMerged } = await loadFresh();
    for (const bad of [
      'x") { id } #',
      'a b',
      '',
      '@',
      'org:',
      '..',
      'a'.repeat(40),
      'a\nb',
    ]) {
      await expect(fetchMerged(bad, 'tok')).resolves.toEqual({
        langs: [],
        repos: [],
      });
    }

    expect(mockGraphql).not.toHaveBeenCalled();
  });

  it('still routes @user, org:name and org/name correctly', async () => {
    const { default: fetchMerged } = await loadFresh();
    mockGraphql.mockResolvedValue(page(['a']));
    await fetchMerged('@someone', 'tok');

    expect(mockGraphql.mock.calls[0][1].login).toBe('someone');
    expect(mockGraphql.mock.calls[0][0]).toContain('user(login');

    mockGraphql.mockResolvedValue(page(['b'], undefined, 'organization'));
    await fetchMerged('org:acme', 'tok');

    expect(mockGraphql.mock.calls[1][1].login).toBe('acme');
    expect(mockGraphql.mock.calls[1][0]).toContain('organization(login');
  });
});

describe('fetchMerged pagination bound', () => {
  it('stops after a bounded number of pages even if GitHub keeps saying hasNextPage', async () => {
    const { MAX_PAGES, default: fetchMerged } = await loadFresh();
    stopAfter(500, 'c');
    const result = await fetchMerged('bigorg', 'tok');

    expect(mockGraphql.mock.calls.length).toBeLessThanOrEqual(MAX_PAGES);
    expect(result.repos.length).toBeGreaterThan(0);
  });

  it('does not loop forever when hasNextPage is true but endCursor is null', async () => {
    const { MAX_PAGES, default: fetchMerged } = await loadFresh();
    stopAfter(500, null);
    await fetchMerged('looper', 'tok');

    expect(mockGraphql.mock.calls.length).toBeLessThanOrEqual(MAX_PAGES);
  });

  it('still follows a normal two-page listing', async () => {
    const { default: fetchMerged } = await loadFresh();
    mockGraphql
      .mockResolvedValueOnce(page(['a'], { endCursor: 'c1', hasNextPage: true }))
      .mockResolvedValueOnce(page(['b']));
    const result = await fetchMerged('twopages', 'tok');

    expect(result.repos).toEqual(['a', 'b']);
    expect(mockGraphql.mock.calls[1][1].after).toBe('c1');
  });
});

describe('fetchMerged cache', () => {
  it('is case-insensitive so case variants cannot bypass it', async () => {
    const { default: fetchMerged } = await loadFresh();
    mockGraphql.mockResolvedValue(page(['a']));
    await fetchMerged('Torvalds', 'tok');
    await fetchMerged('torvalds', 'tok');
    await fetchMerged('TORVALDS', 'tok');
    await fetchMerged('@torvalds', 'tok');

    expect(mockGraphql).toHaveBeenCalledTimes(1);
  });

  it('keeps user and org namespaces separate', async () => {
    const { default: fetchMerged } = await loadFresh();
    mockGraphql.mockResolvedValue(page(['a']));
    await fetchMerged('same', 'tok');
    mockGraphql.mockResolvedValue(page(['b'], undefined, 'organization'));
    const org = await fetchMerged('org:same', 'tok');

    expect(org.repos).toEqual(['b']);
    expect(mockGraphql).toHaveBeenCalledTimes(2);
  });

  it('is bounded in size (oldest entries are evicted)', async () => {
    const { MAX_CACHE_ENTRIES, default: fetchMerged } = await loadFresh();
    mockGraphql.mockResolvedValue(page(['a']));
    for (let index = 0; index <= MAX_CACHE_ENTRIES; index += 1) {
      await fetchMerged(`user${index}`, 'tok');
    }
    const calls = mockGraphql.mock.calls.length;

    expect(calls).toBe(MAX_CACHE_ENTRIES + 1);

    // user0 was the oldest entry and must have been evicted
    await fetchMerged('user0', 'tok');

    expect(mockGraphql.mock.calls.length).toBe(calls + 1);

    // the most recent entry is still cached
    await fetchMerged(`user${MAX_CACHE_ENTRIES}`, 'tok');

    expect(mockGraphql.mock.calls.length).toBe(calls + 1);
  });

  it('does not cache failures', async () => {
    const { default: fetchMerged } = await loadFresh();
    mockGraphql.mockRejectedValueOnce(new Error('network'));

    await expect(fetchMerged('flaky', 'tok')).rejects.toThrow('network');

    mockGraphql.mockResolvedValue(page(['a']));
    const result = await fetchMerged('flaky', 'tok');

    expect(result.repos).toEqual(['a']);
  });
});

describe('fetchMerged upstream errors', () => {
  it('treats a GraphQL NOT_FOUND (unknown user) as an empty result, not a thrown error', async () => {
    const { default: fetchMerged } = await loadFresh();
    mockGraphql.mockRejectedValue(
      Object.assign(new Error('Could not resolve to a User'), {
        errors: [
          {
            message: "Could not resolve to a User with the login of 'ghost'.",
            path: ['user'],
            type: 'NOT_FOUND',
          },
        ],
      }),
    );

    await expect(fetchMerged('ghost', 'tok')).resolves.toEqual({
      langs: [],
      repos: [],
    });
  });

  it('rethrows rate-limit and other errors so the handler can classify them', async () => {
    const { default: fetchMerged } = await loadFresh();
    const rateLimited = Object.assign(new Error('rate limited'), {
      errors: [{ type: 'RATE_LIMITED' }],
    });
    mockGraphql.mockRejectedValue(rateLimited);

    await expect(fetchMerged('busy', 'tok')).rejects.toBe(rateLimited);
  });
});

describe('fetchMerged review follow-ups', () => {
  it('wraps an HTTP 429 so reset / Retry-After survive to the handler', async () => {
    const { default: fetchMerged } = await loadFresh();
    const { GitHubRateLimitError } =
      await import('../../../../server/helpers/github/githubSafety');
    mockGraphql.mockRejectedValue(
      Object.assign(new Error('secondary limit'), {
        response: { headers: { 'retry-after': '42' } },
        status: 429,
      }),
    );

    const error = await fetchMerged('busy2', 'tok').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubRateLimitError);
    expect((error as { retryAfter?: number }).retryAfter).toBe(42);
  });

  it('logs a warning when the listing is truncated at the page cap', async () => {
    const { MAX_PAGES, default: fetchMerged } = await loadFresh();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stopAfter(500, 'c');
    await fetchMerged('hugeorg', 'tok');

    expect(mockGraphql).toHaveBeenCalledTimes(MAX_PAGES);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('truncated'));
    warn.mockRestore();
  });
});

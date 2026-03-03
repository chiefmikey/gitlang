import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGraphql = vi.fn();

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(function () {
    return {
      graphql: mockGraphql,
    };
  }),
}));

import fetchMerged, {
  edgesToLangs,
  parseOwnerName,
} from '../../../../server/helpers/github/merged';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseOwnerName', () => {
  it('strips @ prefix and marks as not an org', () => {
    expect(parseOwnerName('@angular')).toEqual({ isOrg: false, name: 'angular' });
  });

  it('strips org: prefix and marks as org', () => {
    expect(parseOwnerName('org:vercel')).toEqual({ isOrg: true, name: 'vercel' });
  });

  it('strips org/ prefix and marks as org', () => {
    expect(parseOwnerName('org/vercel')).toEqual({ isOrg: true, name: 'vercel' });
  });

  it('returns plain username as not an org', () => {
    expect(parseOwnerName('torvalds')).toEqual({ isOrg: false, name: 'torvalds' });
  });
});

describe('edgesToLangs', () => {
  it('converts an edges array to a language record', () => {
    const edges = [
      { size: 1000, node: { name: 'TypeScript' } },
      { size: 500, node: { name: 'JavaScript' } },
    ];
    expect(edgesToLangs(edges)).toEqual({ TypeScript: 1000, JavaScript: 500 });
  });

  it('returns an empty record for an empty edges array', () => {
    expect(edgesToLangs([])).toEqual({});
  });

  it('last value wins when the same language appears twice', () => {
    const edges = [
      { size: 100, node: { name: 'TypeScript' } },
      { size: 200, node: { name: 'TypeScript' } },
    ];
    expect(edgesToLangs(edges)).toEqual({ TypeScript: 200 });
  });
});

describe('fetchMerged', () => {
  it('returns empty result when token is empty', async () => {
    const result = await fetchMerged('torvalds', '');
    expect(result).toEqual({ repos: [], langs: [] });
    expect(mockGraphql).not.toHaveBeenCalled();
  });

  it('returns repos and langs from GraphQL response', async () => {
    mockGraphql.mockResolvedValue({
      user: {
        repositories: {
          nodes: [
            {
              name: 'repo1',
              isFork: false,
              languages: {
                edges: [{ size: 1000, node: { name: 'TypeScript' } }],
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
      organization: null,
    });

    const result = await fetchMerged('torvalds', 'ghs_token');
    expect(result.repos).toEqual(['repo1']);
    expect(result.langs).toEqual([{ TypeScript: 1000 }]);
  });

  it('filters out forked repositories', async () => {
    mockGraphql.mockResolvedValue({
      user: {
        repositories: {
          nodes: [
            {
              name: 'repo1',
              isFork: false,
              languages: {
                edges: [{ size: 1000, node: { name: 'TypeScript' } }],
              },
            },
            {
              name: 'fork-repo',
              isFork: true,
              languages: {
                edges: [{ size: 500, node: { name: 'JavaScript' } }],
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
      organization: null,
    });

    const result = await fetchMerged('torvalds', 'ghs_token');
    expect(result.repos).toEqual(['repo1']);
    expect(result.repos).not.toContain('fork-repo');
    expect(result.langs).toEqual([{ TypeScript: 1000 }]);
  });

  it('returns empty repos and langs when GraphQL connection is null', async () => {
    mockGraphql.mockResolvedValue({
      user: null,
      organization: null,
    });

    const result = await fetchMerged('ghost', 'ghs_token');
    expect(result.repos).toEqual([]);
    expect(result.langs).toEqual([]);
  });

  it('uses cache on second call — graphql called only once', async () => {
    vi.resetModules();

    const { default: fetchMergedFresh } = await import(
      '../../../../server/helpers/github/merged'
    );

    mockGraphql.mockResolvedValue({
      user: {
        repositories: {
          nodes: [
            {
              name: 'repo1',
              isFork: false,
              languages: {
                edges: [{ size: 1000, node: { name: 'TypeScript' } }],
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
      organization: null,
    });

    await fetchMergedFresh('cacheduser', 'ghs_token');
    await fetchMergedFresh('cacheduser', 'ghs_token');

    expect(mockGraphql).toHaveBeenCalledTimes(1);
  });
});

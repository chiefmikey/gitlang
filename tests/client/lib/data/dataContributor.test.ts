import { beforeEach, describe, expect, it, vi } from 'vitest';

import data, { parseEntry } from '../../../../client/lib/data/index';
import { contributorLanguages } from '../../../../client/lib/data/requests/contributors';
import languages from '../../../../client/lib/data/requests/languages';
import merged from '../../../../client/lib/data/requests/merged';
import repositories from '../../../../client/lib/data/requests/repositories';
import {
  expectFractionsSumToOne,
  LANGS,
  mergedResponse,
  sumBreakdownPercents,
  sumValues,
} from './fixtures';

vi.mock('../../../../client/lib/data/requests/contributors');
vi.mock('../../../../client/lib/data/requests/merged');
vi.mock('../../../../client/lib/data/requests/languages');
vi.mock('../../../../client/lib/data/requests/repositories');

const mockContrib = vi.mocked(contributorLanguages);
const mockMerged = vi.mocked(merged);
const mockLanguages = vi.mocked(languages);
const mockRepositories = vi.mocked(repositories);

// Return per-repo language maps keyed by repo name (the 2nd argument).
const contribByRepo = (map: Record<string, Record<string, number>>) =>
  mockContrib.mockImplementation(
    async (_owner: string, repo: string) => map[repo],
  );

const expectNoNonAuthorFetches = () => {
  expect(mockMerged).not.toHaveBeenCalled();
  expect(mockLanguages).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('parseEntry author extraction', () => {
  it('parses user/repo@author', () => {
    expect(parseEntry('user/repo@author')).toEqual({
      author: 'author',
      owner: 'user',
      repos: ['repo'],
    });
  });

  it('parses user/r1,r2@author', () => {
    expect(parseEntry('user/r1,r2@author')).toEqual({
      author: 'author',
      owner: 'user',
      repos: ['r1', 'r2'],
    });
  });

  it('parses user@author with no repos', () => {
    expect(parseEntry('user@author')).toEqual({
      author: 'author',
      owner: 'user',
      repos: null,
    });
  });

  it('strips @ prefix from the owner and still reads the author', () => {
    expect(parseEntry('@org/repo@author')).toEqual({
      author: 'author',
      owner: 'org',
      repos: ['repo'],
    });
  });

  it('strips org: prefix from the owner and still reads the author', () => {
    expect(parseEntry('org:name/repo@author')).toEqual({
      author: 'author',
      owner: 'name',
      repos: ['repo'],
    });
  });

  it('treats a leading @org (position 0) as an org, not an author', () => {
    expect(parseEntry('@author')).toEqual({
      author: null,
      owner: 'author',
      repos: null,
    });
  });

  it('treats a lone @ as an org prefix with empty owner and no author', () => {
    expect(parseEntry('@')).toEqual({ author: null, owner: '', repos: null });
  });

  it('uses the last @ as the author separator', () => {
    expect(parseEntry('user/repo@a@b')).toEqual({
      author: 'b',
      owner: 'user',
      // Everything before the last @ stays in the repo segment.
      repos: ['repo@a'],
    });
  });

  it.each(['octo-cat', 'john.doe', 'user123', '123', 'dependabot[bot]'])(
    'preserves unusual author %s verbatim',
    (author) => {
      expect(parseEntry(`user/repo@${author}`).author).toBe(author);
    },
  );

  // Behavior is unspecified for an empty author; this documents CURRENT behavior.
  it('yields an empty-string author for a trailing @ (current behavior)', () => {
    expect(parseEntry('user/repo@')).toEqual({
      author: '',
      owner: 'user',
      repos: ['repo'],
    });
  });
});

describe('data() contributor mode', () => {
  describe('single repo', () => {
    it('calls contributorLanguages once with (owner, repo, author)', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.mixed });

      await data('user/repo@author');

      expect(mockContrib).toHaveBeenCalledTimes(1);
      expect(mockContrib).toHaveBeenCalledWith('user', 'repo', 'author');
      expect(mockRepositories).not.toHaveBeenCalled();

      expectNoNonAuthorFetches();
    });

    it('returns allNames, byte fractions and a 100% breakdown', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.mixed });

      const result = await data('user/repo@author');

      expect(result).toEqual({
        data: {
          allNames: ['repo'],
          langBreakdown: {
            CSS: [{ percent: 1, repo: 'repo' }],
            JavaScript: [{ percent: 1, repo: 'repo' }],
            TypeScript: [{ percent: 1, repo: 'repo' }],
          },
          space: { CSS: 0.1, JavaScript: 0.6, TypeScript: 0.3 },
        },
      });
    });
  });

  describe('multiple repos', () => {
    it('calls contributorLanguages once per repo, in order', async () => {
      contribByRepo({ r1: { ...LANGS.jsOnly }, r2: { ...LANGS.tsOnly } });

      await data('user/r1,r2@author');

      expect(mockContrib).toHaveBeenCalledTimes(2);
      expect(mockContrib).toHaveBeenNthCalledWith(1, 'user', 'r1', 'author');
      expect(mockContrib).toHaveBeenNthCalledWith(2, 'user', 'r2', 'author');

      expectNoNonAuthorFetches();
    });

    it('aggregates bytes across repos with fractions summing to 1', async () => {
      contribByRepo({
        r1: { JavaScript: 300, TypeScript: 100 },
        r2: { JavaScript: 100, TypeScript: 500 },
      });

      const result = await data('user/r1,r2@author');
      const { allNames, langBreakdown, space } = (
        result as {
          data: {
            allNames: string[];
            langBreakdown: Record<string, { repo: string; percent: number }[]>;
            space: Record<string, number>;
          };
        }
      ).data;

      expect(allNames).toEqual(['r1', 'r2']);
      // JS 400, TS 600, total 1000
      expect(space.JavaScript).toBeCloseTo(0.4, 10);
      expect(space.TypeScript).toBeCloseTo(0.6, 10);

      expectFractionsSumToOne(space);

      expect(sumValues(space)).toBeCloseTo(1, 10);

      expect(sumBreakdownPercents(langBreakdown, 'JavaScript')).toBeCloseTo(
        1,
        10,
      );
      expect(sumBreakdownPercents(langBreakdown, 'TypeScript')).toBeCloseTo(
        1,
        10,
      );
      // JS: r1 300/400, r2 100/400
      expect(langBreakdown.JavaScript).toEqual([
        { percent: 0.75, repo: 'r1' },
        { percent: 0.25, repo: 'r2' },
      ]);
      // TS: sorted descending, r2 500/600 first
      expect(langBreakdown.TypeScript[0].repo).toBe('r2');
      expect(langBreakdown.TypeScript[0].percent).toBeCloseTo(5 / 6, 10);
      expect(langBreakdown.TypeScript[1].repo).toBe('r1');
      expect(langBreakdown.TypeScript[1].percent).toBeCloseTo(1 / 6, 10);
    });

    it('passes the same author to every repo in a shared-owner list', async () => {
      contribByRepo({ a: { ...LANGS.jsOnly }, b: { ...LANGS.jsOnly }, c: { ...LANGS.jsOnly } });

      await data('user/a,b,c@someone');

      expect(mockContrib.mock.calls).toEqual([
        ['user', 'a', 'someone'],
        ['user', 'b', 'someone'],
        ['user', 'c', 'someone'],
      ]);
    });
  });

  describe('user-level author mode (no repo)', () => {
    it('lists repos with includeForks=true then fetches contributor langs per repo', async () => {
      mockRepositories.mockResolvedValue(['alpha', 'beta', 'gamma']);
      contribByRepo({
        alpha: { ...LANGS.jsOnly },
        beta: { ...LANGS.tsOnly },
        gamma: { ...LANGS.mixed },
      });

      const result = await data('user@author');

      expect(mockRepositories).toHaveBeenCalledTimes(1);
      expect(mockRepositories).toHaveBeenCalledWith('user', true);
      expect(mockContrib.mock.calls).toEqual([
        ['user', 'alpha', 'author'],
        ['user', 'beta', 'author'],
        ['user', 'gamma', 'author'],
      ]);

      expectNoNonAuthorFetches();

      expect(
        (result as { data: { allNames: string[] } }).data.allNames,
      ).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('does not use the merged fast path for user@author', async () => {
      mockRepositories.mockResolvedValue(['alpha']);
      mockContrib.mockResolvedValue({ ...LANGS.jsOnly });

      await data('user@author');

      expect(mockMerged).not.toHaveBeenCalled();
    });

    it('returns an empty result when repositories() returns []', async () => {
      mockRepositories.mockResolvedValue([]);

      const result = await data('user@author');

      expect(mockContrib).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: { allNames: [], langBreakdown: {}, space: {} },
      });
    });

    it('strips @ and org: prefixes from the owner at user level', async () => {
      mockRepositories.mockResolvedValue(['r']);
      mockContrib.mockResolvedValue({ ...LANGS.jsOnly });

      await data('@someorg/r@author');

      expect(mockContrib).toHaveBeenLastCalledWith('someorg', 'r', 'author');

      await data('org:otherorg@author');

      expect(mockRepositories).toHaveBeenLastCalledWith('otherorg', true);
      expect(mockContrib).toHaveBeenLastCalledWith('otherorg', 'r', 'author');
    });
  });

  describe('owner prefixes with explicit repo', () => {
    it('@org/repo@author passes the bare org as owner', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.jsOnly });

      await data('@org/repo@author');

      expect(mockContrib).toHaveBeenCalledWith('org', 'repo', 'author');
    });

    it('org:name/repo@author passes the bare name as owner', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.jsOnly });

      await data('org:name/repo@author');

      expect(mockContrib).toHaveBeenCalledWith('name', 'repo', 'author');
    });
  });

  describe('author formats', () => {
    it.each([
      'octo-cat',
      'john.doe',
      'user123',
      '42',
      'dependabot[bot]',
      'a_b',
    ])('passes author %s through unchanged', async (author) => {
      mockContrib.mockResolvedValue({ ...LANGS.jsOnly });

      await data(`user/repo@${author}`);

      expect(mockContrib).toHaveBeenCalledWith('user', 'repo', author);
    });

    it('uses the text after the last @ as the author when extra @ present', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.jsOnly });

      await data('user/repo@a@b');

      expect(mockContrib).toHaveBeenCalledWith('user', 'repo@a', 'b');
    });
  });

  describe('empty or missing author separator', () => {
    // SUSPECTED BUG candidate: 'user/repo@' has an author separator but an
    // empty author, which is falsy, so the code silently falls back to normal
    // (non-author) repo mode and calls languages(). Pinning CURRENT behavior.
    it('user/repo@ falls back to normal repo mode (current behavior)', async () => {
      mockLanguages.mockResolvedValue([{ ...LANGS.jsOnly }]);

      const result = await data('user/repo@');

      expect(mockContrib).not.toHaveBeenCalled();
      expect(mockLanguages).toHaveBeenCalledWith('user', ['repo']);
      expect(result).toEqual({
        data: {
          allNames: ['repo'],
          langBreakdown: { JavaScript: [{ percent: 1, repo: 'repo' }] },
          space: { JavaScript: 1 },
        },
      });
    });

    it('user@ (empty author, no repo) falls back to the merged path (current behavior)', async () => {
      mockMerged.mockResolvedValue(
        mergedResponse(['r'], [{ ...LANGS.jsOnly }]),
      );

      await data('user@');

      expect(mockContrib).not.toHaveBeenCalled();
      expect(mockMerged).toHaveBeenCalledWith('user');
    });

    it('@author at position 0 is an org lookup via merged, not author mode', async () => {
      mockMerged.mockResolvedValue(
        mergedResponse(['r'], [{ ...LANGS.jsOnly }]),
      );

      await data('@author');

      expect(mockMerged).toHaveBeenCalledWith('author');
      expect(mockContrib).not.toHaveBeenCalled();
    });

    it('a lone @ is an empty org lookup: no request, not author mode', async () => {
      await data('@');

      expect(mockContrib).not.toHaveBeenCalled();
      expect(mockMerged).not.toHaveBeenCalled();
    });
  });

  describe('missing or empty contributor data', () => {
    it('treats {} for a repo as no languages but keeps the repo name', async () => {
      contribByRepo({ r1: {}, r2: { ...LANGS.jsOnly } });

      const result = await data('user/r1,r2@author');

      expect(result).toEqual({
        data: {
          allNames: ['r1', 'r2'],
          langBreakdown: { JavaScript: [{ percent: 1, repo: 'r2' }] },
          space: { JavaScript: 1 },
        },
      });
    });

    it('treats undefined for a repo as {} (|| {} fallback)', async () => {
      mockContrib.mockImplementation(async (_o: string, repo: string) =>
        repo === 'r1' ? (undefined as never) : { ...LANGS.tsOnly },
      );

      const result = await data('user/r1,r2@author');

      expect(result).toEqual({
        data: {
          allNames: ['r1', 'r2'],
          langBreakdown: { TypeScript: [{ percent: 1, repo: 'r2' }] },
          space: { TypeScript: 1 },
        },
      });
    });

    it('returns empty space when every repo is {} for the author', async () => {
      mockContrib.mockResolvedValue({});

      const result = await data('user/r1,r2@author');

      expect(result).toEqual({
        data: { allNames: ['r1', 'r2'], langBreakdown: {}, space: {} },
      });
    });

    it('returns empty space when every repo is undefined for the author', async () => {
      mockContrib.mockResolvedValue(undefined as never);

      const result = await data('user/r1,r2@author');

      expect(result).toEqual({
        data: { allNames: ['r1', 'r2'], langBreakdown: {}, space: {} },
      });
    });

    it('returns empty space when all repos are zero-byte for the author', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.zeroBytes });

      const result = (await data('user/r1,r2@author')) as {
        data: {
          allNames: string[];
          langBreakdown: Record<string, { repo: string; percent: number }[]>;
          space: Record<string, number>;
        };
      };

      expect(result.data.space).toEqual({});
      expect(result.data.allNames).toEqual(['r1', 'r2']);

      // Zero-byte languages never divide by zero: percents are 0, not NaN.
      for (const lang of Object.keys(result.data.langBreakdown)) {
        for (const entry of result.data.langBreakdown[lang]) {
          expect(entry.percent).toBe(0);
        }
      }
    });

    it('ignores zero-byte languages in a partially-zero repo', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.partialZero });

      const result = (await data('user/repo@author')) as {
        data: { space: Record<string, number> };
      };

      expect(result.data.space.JavaScript).toBeCloseTo(1, 10);
      expect(result.data.space.CSS).toBe(0);

      expectFractionsSumToOne(result.data.space);
    });

    it('keeps fractions summing to 1 for odd-rounding splits', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.oddRounding });

      const result = (await data('user/repo@author')) as {
        data: { space: Record<string, number> };
      };

      expect(Object.keys(result.data.space)).toHaveLength(7);

      expectFractionsSumToOne(result.data.space);
    });
  });

  describe('aggregation and compare with per-entry authors', () => {
    it('uses each + entry\'s own author in aggregation', async () => {
      contribByRepo({ r: { ...LANGS.jsOnly } });

      const result = (await data('a/r@x+b/r@y')) as {
        data: { allNames: string[]; space: Record<string, number> };
      };

      expect(mockContrib).toHaveBeenCalledTimes(2);
      expect(mockContrib).toHaveBeenCalledWith('a', 'r', 'x');
      expect(mockContrib).toHaveBeenCalledWith('b', 'r', 'y');
      expect(result.data.allNames).toEqual(['r', 'r']);

      expectFractionsSumToOne(result.data.space);
      expectNoNonAuthorFetches();
    });

    it('mixes author and non-author entries in one aggregation', async () => {
      mockContrib.mockResolvedValue({ ...LANGS.jsOnly });
      mockLanguages.mockResolvedValue([{ ...LANGS.tsOnly }]);

      const result = (await data('a/r@x+b/s')) as {
        data: { space: Record<string, number> };
      };

      expect(mockContrib).toHaveBeenCalledTimes(1);
      expect(mockContrib).toHaveBeenCalledWith('a', 'r', 'x');
      expect(mockLanguages).toHaveBeenCalledWith('b', ['s']);
      expect(result.data.space.JavaScript).toBeCloseTo(2 / 3, 10);
      expect(result.data.space.TypeScript).toBeCloseTo(1 / 3, 10);

      expectFractionsSumToOne(result.data.space);
    });

    it('uses each ~ group\'s own author in compare mode', async () => {
      mockContrib.mockImplementation(async (_o: string, _r: string, author: string) =>
        author === 'x' ? { ...LANGS.jsOnly } : { ...LANGS.tsOnly },
      );

      const result = (await data('a/r@x~a/r@y')) as {
        data: {
          compareGroups: {
            label: string;
            allNames: string[];
            space: Record<string, number>;
          }[];
        };
      };

      expect(mockContrib).toHaveBeenCalledTimes(2);
      expect(mockContrib).toHaveBeenCalledWith('a', 'r', 'x');
      expect(mockContrib).toHaveBeenCalledWith('a', 'r', 'y');

      const groups = result.data.compareGroups;

      expect(groups).toHaveLength(2);
      expect(groups[0].label).toBe('a/r@x');
      expect(groups[0].space).toEqual({ JavaScript: 1 });
      expect(groups[1].label).toBe('a/r@y');
      expect(groups[1].space).toEqual({ TypeScript: 1 });

      expectNoNonAuthorFetches();
    });
  });

  describe('error handling', () => {
    it('propagates a contributorLanguages rejection and logs via console.error', async () => {
      const boom = new Error('contributors failed');
      mockContrib.mockRejectedValue(boom);

      await expect(data('user/repo@author')).rejects.toBe(boom);

      expect(console.error).toHaveBeenCalledWith('Error getting langs', boom);
    });

    it('propagates a rejection from one of several repos', async () => {
      const boom = new Error('second repo failed');
      mockContrib.mockImplementation(async (_o: string, repo: string) => {
        if (repo === 'r2') {throw boom;}
        return { ...LANGS.jsOnly };
      });

      await expect(data('user/r1,r2@author')).rejects.toBe(boom);
      expect(console.error).toHaveBeenCalledWith('Error getting langs', boom);
    });

    it('propagates a repositories() rejection in user-level author mode', async () => {
      const boom = new Error('repos failed');
      mockRepositories.mockRejectedValue(boom);

      await expect(data('user@author')).rejects.toBe(boom);

      expect(mockContrib).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error getting langs', boom);
    });
  });
});

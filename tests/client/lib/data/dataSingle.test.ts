import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import data, {
  parseEntry,
  parseOwnerName,
} from '../../../../client/lib/data/index';
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

vi.mock('../../../../client/lib/data/requests/merged', () => ({
  default: vi.fn(),
}));
vi.mock('../../../../client/lib/data/requests/languages', () => ({
  default: vi.fn(),
}));
vi.mock('../../../../client/lib/data/requests/repositories', () => ({
  default: vi.fn(),
}));
vi.mock('../../../../client/lib/data/requests/contributors', () => ({
  contributorLanguages: vi.fn(),
}));

const mergedMock = vi.mocked(merged);

const expectSlowPathsUnused = () => {
  expect(vi.mocked(repositories)).not.toHaveBeenCalled();
  expect(vi.mocked(languages)).not.toHaveBeenCalled();
  expect(vi.mocked(contributorLanguages)).not.toHaveBeenCalled();
};

describe('data() single-user and org inputs', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mergedMock.mockResolvedValue(
      mergedResponse(['a', 'b'], [LANGS.mixed, LANGS.jsOnly]),
    );
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('owner parsing via the merged fast path', () => {
    it.each([
      ['torvalds', 'torvalds'],
      ['@angular', 'angular'],
      ['org:angular', 'angular'],
      ['Torvalds', 'Torvalds'],
      ['@MyOrg', 'MyOrg'],
      ['org:MiXeD-Case', 'MiXeD-Case'],
      ['ORG:upper', 'ORG:upper'],
      ['user-name_1.x', 'user-name_1.x'],
      ['josé', 'josé'],
      ['用户', '用户'],
      ['@用户', '用户'],
      ['org:émoji😀', 'émoji😀'],
    ])('data(%j) calls merged with owner %j', async (input, owner) => {
      await data(input);

      expect(mergedMock).toHaveBeenCalledTimes(1);
      expect(mergedMock).toHaveBeenCalledWith(owner);

      expectSlowPathsUnused();
    });

    // Unspecified, documented as-is: "org/name" is not a documented org
    // format; entry parsing splits on "/" first, so it reads as user "org"
    // with repo "name" (parseOwnerName's org/ branch is unreachable via data()).
    it('org/name is parsed as owner "org" with repo "name" (current behavior)', () => {
      expect(parseEntry('org/angular')).toEqual({
        author: null,
        owner: 'org',
        repos: ['angular'],
      });
    });

    it('only strips a single leading @ in parseOwnerName', () => {
      expect(parseOwnerName('@@double')).toBe('@double');
    });

    it('does not treat a non-leading @ as an org prefix (author mode)', () => {
      expect(parseEntry('user@author')).toEqual({
        author: 'author',
        owner: 'user',
        repos: null,
      });
    });

    it('parseOwnerName leaves mixed-case and unicode names untouched', () => {
      expect(parseOwnerName('MiXeD')).toBe('MiXeD');
      expect(parseOwnerName('ünï')).toBe('ünï');
      expect(parseOwnerName('@MiXeD')).toBe('MiXeD');
    });
  });

  describe('url update', () => {
    it.each(['torvalds', '@angular', 'org:angular', 'Mixed-Case'])(
      'pushState updates pathname for %j',
      async (input) => {
        await data(input);

        expect(decodeURIComponent(globalThis.location.pathname)).toBe(`/${input}`);
      },
    );

    it('pushes the raw input even when it is later trimmed/stripped', async () => {
      await data('+user+');

      expect(globalThis.location.pathname).toBe('/+user+');
      expect(mergedMock).toHaveBeenCalledWith('user');
    });

    it('calls history.pushState with the input prefixed by a slash', async () => {
      const spy = vi.spyOn(globalThis.history, 'pushState');
      await data('@angular');

      expect(spy).toHaveBeenCalledWith('', '', '/@angular');

      spy.mockRestore();
    });
  });

  describe('result shape', () => {
    it('returns exactly { data: { allNames, space, langBreakdown } }', async () => {
      const result = await data('user');

      expect(Object.keys(result)).toEqual(['data']);
      expect(Object.keys(result.data).sort()).toEqual([
        'allNames',
        'langBreakdown',
        'space',
      ]);
      expect(result.data).not.toHaveProperty('compareGroups');
    });

    it('returns repo names in merged order', async () => {
      const result = await data('user');

      expect(result.data.allNames).toEqual(['a', 'b']);
    });

    it('computes space fractions from merged langs and sums to 1', async () => {
      const result = await data('user');

      // mixed (1000 bytes) + jsOnly (1000 bytes) = 2000 total
      expect(result.data.space.JavaScript).toBeCloseTo(1600 / 2000, 10);
      expect(result.data.space.TypeScript).toBeCloseTo(300 / 2000, 10);
      expect(result.data.space.CSS).toBeCloseTo(100 / 2000, 10);
      expect(Object.keys(result.data.space).sort()).toEqual([
        'CSS',
        'JavaScript',
        'TypeScript',
      ]);

      expectFractionsSumToOne(result.data.space);

      expect(sumValues(result.data.space)).toBeCloseTo(1, 10);
    });

    it('builds langBreakdown per language, sorted desc, summing to 1', async () => {
      const result = await data('user');
      const { langBreakdown } = result.data;

      expect(Object.keys(langBreakdown).sort()).toEqual([
        'CSS',
        'JavaScript',
        'TypeScript',
      ]);
      expect(langBreakdown.JavaScript).toEqual([
        { percent: 1000 / 1600, repo: 'b' },
        { percent: 600 / 1600, repo: 'a' },
      ]);
      expect(langBreakdown.CSS).toEqual([{ percent: 1, repo: 'a' }]);

      for (const lang of Object.keys(langBreakdown)) {
        expect(sumBreakdownPercents(langBreakdown, lang)).toBeCloseTo(1, 10);
      }
    });

    it('produces the same result for plain, @org and org: inputs', async () => {
      const plain = await data('angular');
      const at = await data('@angular');
      const prefixed = await data('org:angular');

      expect(at).toEqual(plain);
      expect(prefixed).toEqual(plain);
    });

    it('handles awkward rounding and still sums to 1', async () => {
      mergedMock.mockResolvedValue(mergedResponse(['r1'], [LANGS.oddRounding]));
      const result = await data('user');

      expect(Object.keys(result.data.space)).toHaveLength(7);

      expectFractionsSumToOne(result.data.space);
    });

    it('handles thirds without drifting from 1', async () => {
      mergedMock.mockResolvedValue(mergedResponse(['r1'], [LANGS.thirds]));
      const result = await data('user');
      expectFractionsSumToOne(result.data.space);
      for (const value of Object.values(result.data.space)) {
        expect(value).toBeCloseTo(1 / 3, 10);
      }
    });
  });

  describe('zero-byte languages', () => {
    it('all-zero bytes gives an empty space but keeps repo names', async () => {
      mergedMock.mockResolvedValue(mergedResponse(['z'], [LANGS.zeroBytes]));
      const result = await data('user');

      expect(result.data.space).toEqual({});
      expect(result.data.allNames).toEqual(['z']);

      expectFractionsSumToOne(result.data.space);
    });

    it('all-zero bytes gives 0 percent breakdown entries (no NaN)', async () => {
      mergedMock.mockResolvedValue(mergedResponse(['z'], [LANGS.zeroBytes]));
      const result = await data('user');

      expect(result.data.langBreakdown.CSS).toEqual([
        { percent: 0, repo: 'z' },
      ]);
      expect(result.data.langBreakdown.JavaScript).toEqual([
        { percent: 0, repo: 'z' },
      ]);
    });

    it('partial zero keeps the 0 entry and the others sum to 1', async () => {
      mergedMock.mockResolvedValue(mergedResponse(['p'], [LANGS.partialZero]));
      const result = await data('user');

      expect(result.data.space).toEqual({ CSS: 0, JavaScript: 1 });

      expectFractionsSumToOne(result.data.space);

      expect(Number.isNaN(result.data.space.CSS)).toBe(false);
    });

    it('partial zero across repos: zero-byte repo gets 0 percent for that language', async () => {
      mergedMock.mockResolvedValue(
        mergedResponse(['p', 'q'], [LANGS.partialZero, { CSS: 50 }]),
      );
      const result = await data('user');

      expect(result.data.langBreakdown.CSS).toEqual([
        { percent: 1, repo: 'q' },
        { percent: 0, repo: 'p' },
      ]);
      expect(sumBreakdownPercents(result.data.langBreakdown, 'CSS')).toBe(1);

      expectFractionsSumToOne(result.data.space);
    });
  });

  describe('missing or empty merged data', () => {
    it('treats an undefined langs entry as an empty repo', async () => {
      mergedMock.mockResolvedValue({
        langs: [LANGS.jsOnly, undefined as unknown as Record<string, number>],
        repos: ['a', 'b'],
      });
      const result = await data('user');

      expect(result.data.allNames).toEqual(['a', 'b']);
      expect(result.data.space).toEqual({ JavaScript: 1 });
      expect(result.data.langBreakdown).toEqual({
        JavaScript: [{ percent: 1, repo: 'a' }],
      });
    });

    it('treats a langs array shorter than repos as empty for the rest', async () => {
      mergedMock.mockResolvedValue({
        langs: [LANGS.tsOnly],
        repos: ['a', 'b', 'c'],
      });
      const result = await data('user');

      expect(result.data.allNames).toEqual(['a', 'b', 'c']);
      expect(result.data.space).toEqual({ TypeScript: 1 });
    });

    it('treats a null langs entry as empty', async () => {
      mergedMock.mockResolvedValue({
        langs: [null as unknown as Record<string, number>],
        repos: ['a'],
      });
      const result = await data('user');

      expect(result.data.allNames).toEqual(['a']);
      expect(result.data.space).toEqual({});
      expect(result.data.langBreakdown).toEqual({});
    });

    it('treats repos with empty language maps as empty', async () => {
      mergedMock.mockResolvedValue(mergedResponse(['a'], [LANGS.empty]));
      const result = await data('user');

      expect(result.data.allNames).toEqual(['a']);
      expect(result.data.space).toEqual({});
      expect(result.data.langBreakdown).toEqual({});
    });

    it('handles an empty user (repos: [])', async () => {
      mergedMock.mockResolvedValue(mergedResponse([], []));
      const result = await data('ghost');

      expect(result).toEqual({
        data: { allNames: [], langBreakdown: {}, space: {} },
      });
      expect(mergedMock).toHaveBeenCalledWith('ghost');

      expectSlowPathsUnused();
    });
  });

  describe('malformed and edge inputs', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['tab and newline only', '\t\n'],
      ['single plus', '+'],
      ['double plus', '++'],
      ['spaces and plus', ' + + '],
    ])(
      '%s resolves to an empty result without calling the API',
      async (_name, input) => {
        const result = await data(input);

        expect(result).toEqual({
          data: { allNames: [], langBreakdown: {}, space: {} },
        });
        expect(mergedMock).not.toHaveBeenCalled();

        expectSlowPathsUnused();
      },
    );

    it('does not throw or log an error for empty input', async () => {
      await expect(data('')).resolves.toBeDefined();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it.each(['+user', 'user+', '+user+', '++user++'])(
      'strips leading/trailing + from %j',
      async (input) => {
        const result = await data(input);

        expect(mergedMock).toHaveBeenCalledTimes(1);
        expect(mergedMock).toHaveBeenCalledWith('user');
        expect(result.data.allNames).toEqual(['a', 'b']);
      },
    );

    it('trims surrounding whitespace around the name', async () => {
      await data('  user  ');

      expect(mergedMock).toHaveBeenCalledWith('user');
    });

    it('trims whitespace around + wrapped names', async () => {
      await data(' +user+ ');

      expect(mergedMock).toHaveBeenCalledWith('user');
    });

    // A bare prefix has no owner, so no request is made at all.
    it.each(['@', 'org:'])(
      'bare prefix %j makes no API request',
      async (input) => {
        await data(input);

        expect(mergedMock).not.toHaveBeenCalled();

        expectSlowPathsUnused();
      },
    );

    it('bare prefix still returns the standard result shape', async () => {
      const result = await data('@');

      expect(result).toEqual({
        data: { allNames: [], langBreakdown: {}, space: {} },
      });
    });
  });

  describe('error path', () => {
    it('rejects with the same error object when merged rejects', async () => {
      const failure = new Error('boom');
      mergedMock.mockRejectedValue(failure);

      await expect(data('user')).rejects.toBe(failure);
    });

    it('logs via console.error with the original error', async () => {
      const failure = new Error('boom');
      mergedMock.mockRejectedValue(failure);

      await expect(data('user')).rejects.toThrow('boom');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('Error getting langs', failure);
    });

    it('still updates the URL even when the fetch fails', async () => {
      mergedMock.mockRejectedValue(new Error('fail'));

      await expect(data('@failing')).rejects.toThrow('fail');
      expect(globalThis.location.pathname).toBe('/@failing');
    });

    it('propagates non-Error rejections unchanged', async () => {
      mergedMock.mockRejectedValue('string failure');

      await expect(data('user')).rejects.toBe('string failure');
      expect(errorSpy).toHaveBeenCalledWith(
        'Error getting langs',
        'string failure',
      );
    });

    it('rejects on a malformed merged payload', async () => {
      mergedMock.mockResolvedValue(
        undefined as unknown as ReturnType<typeof mergedResponse>,
      );

      await expect(data('user')).rejects.toBeInstanceOf(TypeError);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});

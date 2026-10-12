import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import data from '../../../../client/lib/data/index';
import { contributorLanguages } from '../../../../client/lib/data/requests/contributors';
import languages from '../../../../client/lib/data/requests/languages';
import merged from '../../../../client/lib/data/requests/merged';
import repositories from '../../../../client/lib/data/requests/repositories';
import {
  expectFractionsSumToOne,
  type LangMap,
  LANGS,
  sumBreakdownPercents,
  sumValues,
} from './fixtures';

vi.mock('../../../../client/lib/data/requests/languages', () => ({
  default: vi.fn(),
}));
vi.mock('../../../../client/lib/data/requests/merged', () => ({
  default: vi.fn(),
}));
vi.mock('../../../../client/lib/data/requests/repositories', () => ({
  default: vi.fn(),
}));
vi.mock('../../../../client/lib/data/requests/contributors', () => ({
  contributorLanguages: vi.fn(),
}));

const languagesMock = vi.mocked(languages);

/** Language data keyed by repo name; languages() answers per requested name. */
const byName = (table: Record<string, LangMap>) => {
  languagesMock.mockImplementation(async (_owner: string, names: string[]) =>
    names.map((n) => ({ ...table[n] })),
  );
};

type Result = Awaited<ReturnType<typeof data>>;
const single = (r: Result) => {
  if (!('data' in r) || !('allNames' in (r.data as object))) {
    throw new Error('expected single-group result');
  }
  return r.data as {
    allNames: string[];
    space: Record<string, number>;
    langBreakdown: Record<string, { repo: string; percent: number }[]>;
  };
};

describe('data() repo-list inputs', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('username/repo', () => {
    it('calls languages with (owner, [repo]) and nothing else', async () => {
      byName({ repo: LANGS.mixed });
      const r = single(await data('user/repo'));

      expect(languagesMock).toHaveBeenCalledTimes(1);
      expect(languagesMock).toHaveBeenCalledWith('user', ['repo']);
      expect(merged).not.toHaveBeenCalled();
      expect(repositories).not.toHaveBeenCalled();
      expect(contributorLanguages).not.toHaveBeenCalled();
      expect(r.allNames).toEqual(['repo']);
      expect(r.space).toEqual({
        CSS: 0.1,
        JavaScript: 0.6,
        TypeScript: 0.3,
      });
    });

    it('breakdown gives the single repo 100% of each language', async () => {
      byName({ repo: LANGS.mixed });
      const r = single(await data('user/repo'));
      for (const lang of ['CSS', 'JavaScript', 'TypeScript']) {
        expect(r.langBreakdown[lang]).toEqual([{ percent: 1, repo: 'repo' }]);
      }
    });

    it('updates window.location.pathname via pushState', async () => {
      byName({ repo: LANGS.jsOnly });
      await data('user/repo');

      expect(globalThis.location.pathname).toBe('/user/repo');
    });
  });

  describe('username/repo1,repo2[,repo3]', () => {
    it('passes all repos in order and allNames equals the repo list', async () => {
      byName({ a: LANGS.jsOnly, b: LANGS.tsOnly, c: LANGS.mixed });
      const r = single(await data('user/a,b,c'));

      expect(languagesMock).toHaveBeenCalledWith('user', ['a', 'b', 'c']);
      expect(r.allNames).toEqual(['a', 'b', 'c']);
      expect(globalThis.location.pathname).toBe('/user/a,b,c');
    });

    it('aggregates bytes across repos', async () => {
      byName({ a: LANGS.jsOnly, b: LANGS.tsOnly });
      const r = single(await data('user/a,b'));

      // JS 1000, TS 500 => 2/3, 1/3
      expect(r.space.JavaScript).toBeCloseTo(1000 / 1500, 10);
      expect(r.space.TypeScript).toBeCloseTo(500 / 1500, 10);

      expectFractionsSumToOne(r.space);
    });

    it('repos with identical languages split the breakdown evenly', async () => {
      byName({ a: LANGS.mixed, b: LANGS.mixed });
      const r = single(await data('user/a,b'));

      expect(r.space.JavaScript).toBeCloseTo(0.6, 10);
      expect(r.langBreakdown.JavaScript).toHaveLength(2);

      for (const e of r.langBreakdown.JavaScript) {
        expect(e.percent).toBeCloseTo(0.5, 10);
      }

      expect(sumBreakdownPercents(r.langBreakdown, 'JavaScript')).toBeCloseTo(
        1,
        10,
      );
    });

    it('per-language breakdown percents sum to 1 and are sorted descending', async () => {
      byName({
        a: { JavaScript: 100 },
        b: { JavaScript: 600 },
        c: { JavaScript: 300 },
      });
      const r = single(await data('user/a,b,c'));

      expect(r.langBreakdown.JavaScript.map((e) => e.repo)).toEqual([
        'b',
        'c',
        'a',
      ]);

      const percents = r.langBreakdown.JavaScript.map((e) => e.percent);

      expect(percents).toEqual([...percents].sort((x, y) => y - x));
      expect(percents[0]).toBeCloseTo(0.6, 10);
      expect(sumBreakdownPercents(r.langBreakdown, 'JavaScript')).toBeCloseTo(
        1,
        10,
      );
    });

    it('space fractions sum to 1 for awkward divisions (sevenths, thirds)', async () => {
      byName({ a: LANGS.oddRounding, b: LANGS.thirds });
      const r = single(await data('user/a,b'));
      expectFractionsSumToOne(r.space);

      expect(sumValues(r.space)).toBeCloseTo(1, 10);
    });
  });

  describe('org owners', () => {
    it('@org/repo strips the @ from the owner', async () => {
      byName({ repo: LANGS.jsOnly });
      const r = single(await data('@angular/repo'));

      expect(languagesMock).toHaveBeenCalledWith('angular', ['repo']);
      expect(r.allNames).toEqual(['repo']);
    });

    it('@org/repo1,repo2 strips the @ and keeps repo order', async () => {
      byName({ x: LANGS.jsOnly, y: LANGS.tsOnly });
      const r = single(await data('@angular/x,y'));

      expect(languagesMock).toHaveBeenCalledWith('angular', ['x', 'y']);
      expect(r.allNames).toEqual(['x', 'y']);
    });

    it('org:name/repo1,repo2 strips the org: prefix from the owner', async () => {
      byName({ x: LANGS.jsOnly, y: LANGS.tsOnly });
      const r = single(await data('org:acme/x,y'));

      expect(languagesMock).toHaveBeenCalledWith('acme', ['x', 'y']);
      expect(r.allNames).toEqual(['x', 'y']);
      expect(merged).not.toHaveBeenCalled();
      expect(repositories).not.toHaveBeenCalled();
      expect(contributorLanguages).not.toHaveBeenCalled();
    });

    it('org:name/repo works with a single repo', async () => {
      byName({ x: LANGS.jsOnly });
      await data('org:acme/x');

      expect(languagesMock).toHaveBeenCalledWith('acme', ['x']);
    });
  });

  describe('malformed separators', () => {
    it('ignores a trailing comma (user/a,b,)', async () => {
      byName({ a: LANGS.jsOnly, b: LANGS.tsOnly });
      const r = single(await data('user/a,b,'));

      expect(languagesMock).toHaveBeenCalledWith('user', ['a', 'b']);
      expect(r.allNames).toEqual(['a', 'b']);
    });

    it('ignores a leading comma (user/,a,b)', async () => {
      byName({ a: LANGS.jsOnly, b: LANGS.tsOnly });
      const r = single(await data('user/,a,b'));

      expect(languagesMock).toHaveBeenCalledWith('user', ['a', 'b']);
      expect(r.allNames).toEqual(['a', 'b']);
    });

    it('ignores a double comma (user/a,,b)', async () => {
      byName({ a: LANGS.jsOnly, b: LANGS.tsOnly });
      const r = single(await data('user/a,,b'));

      expect(languagesMock).toHaveBeenCalledWith('user', ['a', 'b']);
      expect(r.allNames).toEqual(['a', 'b']);
    });

    it('trailing slash (user/) yields an empty repo list and no fallback to the merged endpoint', async () => {
      byName({});
      const r = single(await data('user/'));

      expect(merged).not.toHaveBeenCalled();
      expect(languagesMock).toHaveBeenCalledWith('user', []);
      expect(r.allNames).toEqual([]);
      expect(r.space).toEqual({});
      expect(r.langBreakdown).toEqual({});
    });

    it('comma-only segment (user/,) yields an empty repo list', async () => {
      byName({});
      const r = single(await data('user/,'));

      expect(languagesMock).toHaveBeenCalledWith('user', []);
      expect(r.allNames).toEqual([]);
      expect(r.space).toEqual({});
    });

    it('double slash (user//repo) skips the empty segment', async () => {
      byName({ repo: LANGS.jsOnly });
      const r = single(await data('user//repo'));

      expect(languagesMock).toHaveBeenCalledWith('user', ['repo']);
      expect(r.allNames).toEqual(['repo']);
    });

    // Behavior is unspecified: current code flattens extra slash segments
    // into additional repo names. Documented as-is.
    it('extra slash segments (user/a/b) are flattened into repos [a, b] (current behavior)', async () => {
      byName({ a: LANGS.jsOnly, b: LANGS.tsOnly });
      const r = single(await data('user/a/b'));

      expect(languagesMock).toHaveBeenCalledWith('user', ['a', 'b']);
      expect(r.allNames).toEqual(['a', 'b']);
    });

    it('slashes and commas mix (user/a/b,c)', async () => {
      byName({ a: LANGS.jsOnly, b: LANGS.jsOnly, c: LANGS.jsOnly });
      const r = single(await data('user/a/b,c'));

      expect(languagesMock).toHaveBeenCalledWith('user', ['a', 'b', 'c']);
      expect(r.allNames).toEqual(['a', 'b', 'c']);
    });
  });

  describe('duplicate repo names', () => {
    // The same owner/repo should be counted once. If these fail the code
    // double-counts bytes (SUSPECTED BUG: no dedupe in parseEntry/fetchEntryData).
    it('user/repo,repo counts the repo once in allNames', async () => {
      byName({ repo: LANGS.jsOnly });
      const r = single(await data('user/repo,repo'));

      expect(r.allNames).toEqual(['repo']);
    });

    it('user/repo,repo lists the repo once in the language breakdown', async () => {
      byName({ repo: LANGS.mixed });
      const r = single(await data('user/repo,repo'));

      expect(r.langBreakdown.JavaScript).toEqual([
        { percent: 1, repo: 'repo' },
      ]);
    });

    it('user/a,b,a does not double-count a in space fractions', async () => {
      byName({ a: { JavaScript: 1000 }, b: { TypeScript: 1000 } });
      const r = single(await data('user/a,b,a'));

      expect(r.space.JavaScript).toBeCloseTo(0.5, 10);
      expect(r.space.TypeScript).toBeCloseTo(0.5, 10);

      expectFractionsSumToOne(r.space);
    });

    it('user/a,b,a keeps the order of first appearance', async () => {
      byName({ a: LANGS.jsOnly, b: LANGS.tsOnly });
      const r = single(await data('user/a,b,a'));

      expect(r.allNames).toEqual(['a', 'b']);
    });

    it('user/a,b,a lists a once in the breakdown', async () => {
      byName({ a: { JavaScript: 1000 }, b: { JavaScript: 1000 } });
      const r = single(await data('user/a,b,a'));

      expect(r.langBreakdown.JavaScript).toHaveLength(2);
      expect(sumBreakdownPercents(r.langBreakdown, 'JavaScript')).toBeCloseTo(
        1,
        10,
      );
    });
  });

  describe('language data edge cases', () => {
    it('all zero-byte languages produce empty space without NaN', async () => {
      byName({ a: LANGS.zeroBytes });
      const r = single(await data('user/a'));

      expect(r.space).toEqual({});
      expect(JSON.stringify(r)).not.toContain('null');

      for (const entries of Object.values(r.langBreakdown)) {
        for (const e of entries) {
          expect(Number.isNaN(e.percent)).toBe(false);
          expect(e.percent).toBe(0);
        }
      }
    });

    it('a zero-byte language alongside real ones gets 0 and the rest still sum to 1', async () => {
      byName({ a: LANGS.partialZero, b: LANGS.tsOnly });
      const r = single(await data('user/a,b'));

      expect(r.space.CSS).toBe(0);

      expectFractionsSumToOne(r.space);

      expect(r.space.JavaScript).toBeCloseTo(900 / 1400, 10);
      expect(r.langBreakdown.CSS.every((e) => e.percent === 0)).toBe(true);
    });

    it('repos with empty language maps contribute nothing but stay in allNames', async () => {
      byName({ a: LANGS.empty, b: LANGS.jsOnly });
      const r = single(await data('user/a,b'));

      expect(r.allNames).toEqual(['a', 'b']);
      expect(r.space).toEqual({ JavaScript: 1 });
      expect(r.langBreakdown.JavaScript).toEqual([{ percent: 1, repo: 'b' }]);
    });

    it('languages() returning fewer entries than repos treats the missing ones as empty', async () => {
      languagesMock.mockResolvedValue([{ JavaScript: 100 }]);
      const r = single(await data('user/a,b,c'));

      expect(r.allNames).toEqual(['a', 'b', 'c']);
      expect(r.space).toEqual({ JavaScript: 1 });
      expect(r.langBreakdown.JavaScript).toEqual([{ percent: 1, repo: 'a' }]);
    });

    it('languages() returning [] yields empty space and breakdown but keeps names', async () => {
      languagesMock.mockResolvedValue([]);
      const r = single(await data('user/a,b'));

      expect(r.allNames).toEqual(['a', 'b']);
      expect(r.space).toEqual({});
      expect(r.langBreakdown).toEqual({});
    });

    it('languages() returning null/undefined entries treats them as empty', async () => {
      languagesMock.mockResolvedValue([
        null,
        { TypeScript: 10 },
      ] as unknown as LangMap[]);
      const r = single(await data('user/a,b'));

      expect(r.space).toEqual({ TypeScript: 1 });
    });
  });

  describe('percentages', () => {
    it('space fractions sum to 1 and breakdowns sum to 1 per language for a larger mix', async () => {
      byName({
        a: LANGS.mixed,
        b: LANGS.thirds,
        c: LANGS.oddRounding,
        d: LANGS.tsOnly,
        e: LANGS.jsOnly,
      });
      const r = single(await data('user/a,b,c,d,e'));
      expectFractionsSumToOne(r.space);
      for (const lang of Object.keys(r.langBreakdown)) {
        expect(sumBreakdownPercents(r.langBreakdown, lang)).toBeCloseTo(1, 10);

        const p = r.langBreakdown[lang].map((e) => e.percent);

        expect(p).toEqual([...p].sort((x, y) => y - x));
      }
    });

    it('every language in space has a breakdown entry and vice versa', async () => {
      byName({ a: LANGS.mixed, b: LANGS.tsOnly });
      const r = single(await data('user/a,b'));

      expect(Object.keys(r.langBreakdown).sort()).toEqual(
        Object.keys(r.space).sort(),
      );
    });
  });

  describe('error path', () => {
    it('rejects and logs via console.error when languages() rejects', async () => {
      const boom = new Error('network down');
      languagesMock.mockRejectedValue(boom);

      await expect(data('user/a,b')).rejects.toBe(boom);
      expect(errorSpy).toHaveBeenCalledWith('Error getting langs', boom);
    });

    it('still pushes the URL state before the failure', async () => {
      languagesMock.mockRejectedValue(new Error('nope'));

      await expect(data('user/zzz')).rejects.toThrow('nope');
      expect(globalThis.location.pathname).toBe('/user/zzz');
    });
  });
});

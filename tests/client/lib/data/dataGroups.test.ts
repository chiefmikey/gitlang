import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import data from '../../../../client/lib/data/index';
import { contributorLanguages } from '../../../../client/lib/data/requests/contributors';
import languages from '../../../../client/lib/data/requests/languages';
import merged from '../../../../client/lib/data/requests/merged';
import repositories from '../../../../client/lib/data/requests/repositories';
import {
  expectFractionsSumToOne,
  type LangMap,
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

interface Fixture {
  repos: string[];
  langs: LangMap[];
  delay?: number;
}

interface Group {
  label: string;
  allNames: string[];
  space: Record<string, number>;
  langBreakdown: Record<string, { repo: string; percent: number }[]>;
}

interface Compare {
  data: { compareGroups: Group[] };
}

interface Single {
  data: {
    allNames: string[];
    space: Record<string, number>;
    langBreakdown: Record<string, { repo: string; percent: number }[]>;
  };
}

const mergedMock = vi.mocked(merged);
const languagesMock = vi.mocked(languages);
const repositoriesMock = vi.mocked(repositories);
const contributorMock = vi.mocked(contributorLanguages);

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Drive merged() by owner. Unknown owners resolve with no repos. */
const setUsers = (users: Record<string, Fixture>) => {
  mergedMock.mockImplementation(async (owner: string) => {
    const fixture = users[owner];
    if (fixture?.delay) {await sleep(fixture.delay);}
    return fixture
      ? mergedResponse(fixture.repos, fixture.langs)
      : mergedResponse([], []);
  });
};

const U = {
  a: { langs: [LANGS.mixed, LANGS.jsOnly], repos: ['a1', 'a2'] },
  b: { langs: [LANGS.tsOnly], repos: ['b1'] },
  c: {
    langs: [LANGS.thirds, LANGS.jsOnly, LANGS.mixed],
    repos: ['c1', 'c2', 'c3'],
  },
} satisfies Record<string, Fixture>;

describe('data() aggregation and compare', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mergedMock.mockReset();
    languagesMock.mockReset();
    repositoriesMock.mockReset();
    contributorMock.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.history.replaceState('', '', '/');
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  describe('aggregation with +', () => {
    it('sums bytes across two users and keeps non-compare shape', async () => {
      setUsers(U);
      const result = (await data('a+b')) as Single;

      expect(Object.keys(result.data).sort()).toEqual([
        'allNames',
        'langBreakdown',
        'space',
      ]);
      // a: JS 600+1000, TS 300, CSS 100; b: TS 500. total = 2500
      expect(result.data.space.JavaScript).toBeCloseTo(1600 / 2500, 10);
      expect(result.data.space.TypeScript).toBeCloseTo(800 / 2500, 10);
      expect(result.data.space.CSS).toBeCloseTo(100 / 2500, 10);

      expectFractionsSumToOne(result.data.space);
    });

    it('concatenates allNames in input order', async () => {
      setUsers(U);
      const result = (await data('b+a')) as Single;

      expect(result.data.allNames).toEqual(['b1', 'a1', 'a2']);
    });

    it('builds langBreakdown across users', async () => {
      setUsers(U);
      const { data: d } = (await data('a+b')) as Single;

      expect(d.langBreakdown.TypeScript).toHaveLength(2);

      const ts = Object.fromEntries(
        d.langBreakdown.TypeScript.map((e) => [e.repo, e.percent]),
      );

      expect(ts.a1).toBeCloseTo(300 / 800, 10);
      expect(ts.b1).toBeCloseTo(500 / 800, 10);
      expect(sumBreakdownPercents(d.langBreakdown, 'TypeScript')).toBeCloseTo(
        1,
        10,
      );
      expect(sumBreakdownPercents(d.langBreakdown, 'JavaScript')).toBeCloseTo(
        1,
        10,
      );
      expect(d.langBreakdown.JavaScript.map((e) => e.repo)).toEqual([
        'a2',
        'a1',
      ]);
    });

    it('aggregates three users', async () => {
      setUsers(U);
      const { data: d } = (await data('a+b+c')) as Single;

      expect(d.allNames).toEqual(['a1', 'a2', 'b1', 'c1', 'c2', 'c3']);

      const total = 2000 + 500 + 2003;

      expect(d.space.TypeScript).toBeCloseTo((300 + 500 + 1 + 300) / total, 10);

      expectFractionsSumToOne(d.space);
      for (const lang of Object.keys(d.space)) {
        expect(sumBreakdownPercents(d.langBreakdown, lang)).toBeCloseTo(1, 10);
      }
    });

    it('aggregates mixed forms: user plus user/repo', async () => {
      setUsers(U);
      languagesMock.mockImplementation(async (_owner, repos) =>
        repos.map(() => ({ ...LANGS.tsOnly })),
      );
      const { data: d } = (await data('a+b/repo')) as Single;

      expect(mergedMock).toHaveBeenCalledWith('a');
      expect(mergedMock).not.toHaveBeenCalledWith('b');
      expect(languagesMock).toHaveBeenCalledWith('b', ['repo']);
      expect(d.allNames).toEqual(['a1', 'a2', 'repo']);
      expect(d.space.TypeScript).toBeCloseTo(800 / 2500, 10);

      expectFractionsSumToOne(d.space);
    });

    it('aggregates user/r1,r2 plus an @org', async () => {
      setUsers({ org: { langs: [LANGS.jsOnly], repos: ['o1'] } });
      languagesMock.mockImplementation(async (_owner, repos) =>
        repos.map(() => ({ ...LANGS.tsOnly })),
      );
      const { data: d } = (await data('a/r1,r2+@org')) as Single;

      expect(languagesMock).toHaveBeenCalledWith('a', ['r1', 'r2']);
      expect(mergedMock).toHaveBeenCalledWith('org');
      expect(d.allNames).toEqual(['r1', 'r2', 'o1']);
      expect(d.space.TypeScript).toBeCloseTo(1000 / 2000, 10);
      expect(d.space.JavaScript).toBeCloseTo(1000 / 2000, 10);
    });

    it('trims spaces around the plus', async () => {
      setUsers(U);
      const { data: d } = (await data('a + b')) as Single;

      expect(mergedMock).toHaveBeenCalledWith('a');
      expect(mergedMock).toHaveBeenCalledWith('b');
      expect(mergedMock).toHaveBeenCalledTimes(2);
      expect(d.allNames).toEqual(['a1', 'a2', 'b1']);
    });

    it.each(['a+', '+a', 'a++', '++a++'])(
      'ignores empty segments for %s',
      async (input) => {
        setUsers(U);
        const { data: d } = (await data(input)) as Single;

        expect(mergedMock).toHaveBeenCalledTimes(1);
        expect(mergedMock).toHaveBeenCalledWith('a');
        expect(d.allNames).toEqual(['a1', 'a2']);
      },
    );

    it('ignores a doubled plus between users (a++b)', async () => {
      setUsers(U);
      const { data: d } = (await data('a++b')) as Single;

      expect(mergedMock).toHaveBeenCalledTimes(2);
      expect(d.allNames).toEqual(['a1', 'a2', 'b1']);

      expectFractionsSumToOne(d.space);
    });

    it('a+a: fetches twice and duplicates names/breakdown, ratio unchanged (unspecified, described as-is)', async () => {
      setUsers(U);
      const { data: d } = (await data('a+a')) as Single;

      expect(mergedMock).toHaveBeenCalledTimes(2);
      expect(d.allNames).toEqual(['a1', 'a2', 'a1', 'a2']);

      const solo = (await data('a')) as Single;
      for (const lang of Object.keys(solo.data.space)) {
        expect(d.space[lang]).toBeCloseTo(solo.data.space[lang], 10);
      }

      expect(d.langBreakdown.JavaScript).toHaveLength(4);

      expectFractionsSumToOne(d.space);
    });

    it('returns an empty result for a user with no repos', async () => {
      setUsers({});
      const { data: d } = (await data('ghost')) as Single;

      expect(d.allNames).toEqual([]);
      expect(d.space).toEqual({});
      expect(d.langBreakdown).toEqual({});
    });

    it('yields empty space when all aggregated bytes are zero', async () => {
      setUsers({ z: { langs: [LANGS.zeroBytes], repos: ['z1'] } });
      const { data: d } = (await data('z+z')) as Single;

      expect(d.space).toEqual({});
      expect(sumValues(d.space)).toBe(0);
    });
  });

  describe('compare with ~', () => {
    it('returns compareGroups with label, allNames, space, langBreakdown', async () => {
      setUsers(U);
      const result = (await data('a~b')) as Compare;

      expect(Object.keys(result.data)).toEqual(['compareGroups']);

      const [ga, gb] = result.data.compareGroups;

      expect(Object.keys(ga).sort()).toEqual([
        'allNames',
        'label',
        'langBreakdown',
        'space',
      ]);
      expect(ga.label).toBe('a');
      expect(gb.label).toBe('b');
      expect(ga.allNames).toEqual(['a1', 'a2']);
      expect(gb.allNames).toEqual(['b1']);
      expect(gb.space).toEqual({ TypeScript: 1 });
      expect(ga.space.JavaScript).toBeCloseTo(1600 / 2000, 10);
    });

    it('computes each group space independently and sums to 1', async () => {
      setUsers(U);
      const { data: d } = (await data('a~b~c')) as Compare;

      expect(d.compareGroups).toHaveLength(3);
      expect(d.compareGroups.map((g) => g.label)).toEqual(['a', 'b', 'c']);
      expect(d.compareGroups[0].space.JavaScript).toBeCloseTo(1600 / 2000, 10);
      expect(d.compareGroups[0].space.TypeScript).toBeCloseTo(300 / 2000, 10);

      for (const g of d.compareGroups) {
        expectFractionsSumToOne(g.space);
        for (const lang of Object.keys(g.space)) {
          expect(sumBreakdownPercents(g.langBreakdown, lang)).toBeCloseTo(
            1,
            10,
          );
        }
      }
    });

    it('supports aggregation inside a group (a+b~c)', async () => {
      setUsers(U);
      const { data: d } = (await data('a+b~c')) as Compare;

      expect(d.compareGroups).toHaveLength(2);
      expect(d.compareGroups[0].label).toBe('a+b');
      expect(d.compareGroups[0].allNames).toEqual(['a1', 'a2', 'b1']);
      expect(d.compareGroups[0].space.TypeScript).toBeCloseTo(800 / 2500, 10);
      expect(d.compareGroups[1].label).toBe('c');
      expect(d.compareGroups[1].allNames).toEqual(['c1', 'c2', 'c3']);

      for (const g of d.compareGroups) {expectFractionsSumToOne(g.space);}
    });

    it('supports aggregation in both groups (a+b~b+c)', async () => {
      setUsers(U);
      const { data: d } = (await data('a+b~b+c')) as Compare;

      expect(d.compareGroups.map((g) => g.allNames)).toEqual([
        ['a1', 'a2', 'b1'],
        ['b1', 'c1', 'c2', 'c3'],
      ]);
    });

    it('trims group labels', async () => {
      setUsers(U);
      const { data: d } = (await data('  a + b  ~  c ')) as Compare;

      expect(d.compareGroups.map((g) => g.label)).toEqual(['a + b', 'c']);
    });

    it.each([
      ['a~~b', ['a', 'b']],
      ['~a~b', ['a', 'b']],
      ['a~b~', ['a', 'b']],
      ['a~~~b~~c', ['a', 'b', 'c']],
      ['a~ ~b', ['a', 'b']],
    ])('drops empty groups for %s', async (input, labels) => {
      setUsers(U);
      const { data: d } = (await data(input)) as Compare;

      expect(d.compareGroups.map((g) => g.label)).toEqual(labels);
    });

    it.each(['a~', '~a', 'a~ ', ' ~a', 'a~+'])(
      'a single remaining group (%s) returns the non-compare shape',
      async (input) => {
        setUsers(U);
        const result = (await data(input)) as Compare & Single;

        expect(result.data.compareGroups).toBeUndefined();
        expect(result.data.allNames).toEqual(['a1', 'a2']);
        expect(mergedMock).toHaveBeenCalledTimes(1);
        expect(mergedMock).toHaveBeenCalledWith('a');
      },
    );

    it('strips leading and trailing plus inside groups', async () => {
      setUsers(U);
      const { data: d } = (await data('+a+~+b+')) as Compare;

      expect(d.compareGroups.map((g) => g.label)).toEqual(['a', 'b']);
    });

    it.each(['~', '~~', ' ~ '])(
      'input %j (only separators) should not request a user literally named "~"',
      async (input) => {
        setUsers(U);
        const result = (await data(input)) as Single;
        const owners = mergedMock.mock.calls.map((c) => c[0]);

        expect(owners).not.toContain('~');
        expect(mergedMock).not.toHaveBeenCalled();
        expect(result.data.allNames).toEqual([]);
        expect(result.data.space).toEqual({});
      },
    );

    it('gives an empty space for a group with zero-byte languages, leaving others intact', async () => {
      setUsers({ ...U, z: { langs: [LANGS.zeroBytes], repos: ['z1'] } });
      const { data: d } = (await data('z~b')) as Compare;

      expect(d.compareGroups[0].space).toEqual({});
      expect(d.compareGroups[0].allNames).toEqual(['z1']);
      expect(d.compareGroups[1].space).toEqual({ TypeScript: 1 });
    });

    it('gives an empty space for a group with empty languages', async () => {
      setUsers({ ...U, e: { langs: [LANGS.empty], repos: ['e1'] } });
      const { data: d } = (await data('a~e')) as Compare;

      expect(d.compareGroups[1].space).toEqual({});
      expect(d.compareGroups[1].langBreakdown).toEqual({});

      expectFractionsSumToOne(d.compareGroups[0].space);

      expect(d.compareGroups[0].space.JavaScript).toBeGreaterThan(0);
    });

    it('gives an empty group for an unknown user with no repos', async () => {
      setUsers(U);
      const { data: d } = (await data('a~ghost')) as Compare;

      expect(d.compareGroups[1]).toEqual({
        allNames: [],
        label: 'ghost',
        langBreakdown: {},
        space: {},
      });
    });

    it('preserves group order even when requests resolve out of order', async () => {
      setUsers({
        a: { ...U.a, delay: 40 },
        b: { ...U.b, delay: 20 },
        c: { ...U.c, delay: 0 },
      });
      const { data: d } = (await data('a~b~c')) as Compare;

      expect(d.compareGroups.map((g) => g.label)).toEqual(['a', 'b', 'c']);
      expect(d.compareGroups[0].allNames).toEqual(['a1', 'a2']);
      expect(d.compareGroups[2].allNames).toEqual(['c1', 'c2', 'c3']);
    });

    it('rejects the whole call when one group fails, logging the error', async () => {
      const boom = new Error('boom');
      mergedMock.mockImplementation(async (owner: string) => {
        if (owner === 'b') {throw boom;}
        return mergedResponse(U.a.repos, U.a.langs);
      });

      await expect(data('a~b')).rejects.toBe(boom);
      expect(errorSpy).toHaveBeenCalledWith('Error getting langs', boom);
    });

    it('rejects an aggregated single group when one member fails', async () => {
      const boom = new Error('nope');
      mergedMock.mockImplementation(async (owner: string) => {
        if (owner === 'b') {throw boom;}
        return mergedResponse(U.a.repos, U.a.langs);
      });

      await expect(data('a+b')).rejects.toBe(boom);
      expect(errorSpy).toHaveBeenCalledWith('Error getting langs', boom);
    });
  });

  describe('history', () => {
    it('pushes /${input} to the location pathname', async () => {
      setUsers(U);
      await data('a+b');

      expect(decodeURIComponent(globalThis.location.pathname)).toBe('/a+b');
    });

    it('pushes the raw compare input', async () => {
      setUsers(U);
      await data('a~b');

      expect(decodeURIComponent(globalThis.location.pathname)).toBe('/a~b');
    });

    it('pushes state even when the requests fail', async () => {
      mergedMock.mockRejectedValue(new Error('x'));

      await expect(data('a~b')).rejects.toThrow('x');
      expect(decodeURIComponent(globalThis.location.pathname)).toBe('/a~b');
    });
  });
});

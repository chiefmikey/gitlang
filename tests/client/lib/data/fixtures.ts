import { expect } from 'vitest';

export type LangMap = Record<string, number>;

export const LANGS: {
  jsOnly: LangMap;
  mixed: LangMap;
  tsOnly: LangMap;
  zeroBytes: LangMap;
  partialZero: LangMap;
  empty: LangMap;
  thirds: LangMap;
  oddRounding: LangMap;
} = {
  empty: {},
  jsOnly: { JavaScript: 1000 },
  mixed: { CSS: 100, JavaScript: 600, TypeScript: 300 },
  oddRounding: { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1 },
  partialZero: { CSS: 0, JavaScript: 900 },
  thirds: { CSS: 1, JavaScript: 1, TypeScript: 1 },
  tsOnly: { TypeScript: 500 },
  zeroBytes: { CSS: 0, JavaScript: 0 },
};

export function mergedResponse(
  repos: string[],
  langs: LangMap[],
): { repos: string[]; langs: LangMap[] } {
  return {
    langs: langs.map((m) => ({ ...m })),
    repos: [...repos],
  };
}

export function sumValues(m: Record<string, number>): number {
  return Object.values(m).reduce((accumulator, v) => accumulator + v, 0);
}

export function sumBreakdownPercents(
  b: Record<string, { repo: string; percent: number }[]>,
  lang: string,
): number {
  return (b[lang] ?? []).reduce((accumulator, entry) => accumulator + entry.percent, 0);
}

export function expectFractionsSumToOne(space: Record<string, number>): void {
  if (Object.keys(space).length > 0) {
    expect(sumValues(space)).toBeCloseTo(1, 10);
  } else {
    expect(Object.keys(space)).toHaveLength(0);
  }
}

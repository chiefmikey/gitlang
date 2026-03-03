import { describe, it, expect } from 'vitest';
import getSize, {
  eachSize,
  percentage,
  totalSize,
} from '../../../../../client/lib/data/helpers/size';

describe('totalSize', () => {
  it('returns 0 for an empty array', () => {
    expect(totalSize([])).toBe(0);
  });

  it('sums values in a single language record', () => {
    expect(totalSize([{ TypeScript: 4000, JavaScript: 1000 }])).toBe(5000);
  });

  it('sums values across multiple language records', () => {
    expect(
      totalSize([
        { TypeScript: 5000, JavaScript: 3000 },
        { CSS: 2000 },
      ]),
    ).toBe(10000);
  });

  it('handles overlapping keys across records by summing all values independently', () => {
    // totalSize sums raw values, not deduped — each record's values count separately
    expect(
      totalSize([
        { TypeScript: 1000 },
        { TypeScript: 500 },
        { TypeScript: 250 },
      ]),
    ).toBe(1750);
  });

  it('returns 0 for a single empty language record', () => {
    expect(totalSize([{}])).toBe(0);
  });

  it('handles a single key with value 0', () => {
    expect(totalSize([{ TypeScript: 0 }])).toBe(0);
  });
});

describe('eachSize', () => {
  it('returns an empty object for an empty array', () => {
    expect(eachSize([])).toEqual({});
  });

  it('returns the same record for a single input', () => {
    expect(eachSize([{ TypeScript: 5000, JavaScript: 3000 }])).toEqual({
      TypeScript: 5000,
      JavaScript: 3000,
    });
  });

  it('merges multiple records without overlap by unioning keys', () => {
    expect(
      eachSize([{ TypeScript: 5000 }, { JavaScript: 3000 }, { CSS: 2000 }]),
    ).toEqual({ TypeScript: 5000, JavaScript: 3000, CSS: 2000 });
  });

  it('sums values for overlapping keys across records', () => {
    expect(
      eachSize([
        { TypeScript: 1000, JavaScript: 500 },
        { TypeScript: 2000, CSS: 300 },
      ]),
    ).toEqual({ TypeScript: 3000, JavaScript: 500, CSS: 300 });
  });

  it('handles all records being empty objects', () => {
    expect(eachSize([{}, {}, {}])).toEqual({});
  });

  it('handles a mix of empty and non-empty records', () => {
    expect(eachSize([{}, { Python: 1234 }, {}])).toEqual({ Python: 1234 });
  });
});

describe('percentage', () => {
  it('divides each value by the given size', () => {
    const result = percentage(10000, {
      TypeScript: 5000,
      JavaScript: 3000,
      CSS: 2000,
    });
    expect(result).toEqual({ TypeScript: 0.5, JavaScript: 0.3, CSS: 0.2 });
  });

  it('returns an empty object when size is 0', () => {
    expect(percentage(0, { TypeScript: 5000 })).toEqual({});
  });

  it('returns an empty object when size is 0 and allSizes is empty', () => {
    expect(percentage(0, {})).toEqual({});
  });

  it('returns 1 for a single language that makes up the full size', () => {
    expect(percentage(4000, { TypeScript: 4000 })).toEqual({ TypeScript: 1 });
  });

  it('produces correct fractions for two languages', () => {
    const result = percentage(8000, { TypeScript: 6000, JavaScript: 2000 });
    expect(result.TypeScript).toBeCloseTo(0.75);
    expect(result.JavaScript).toBeCloseTo(0.25);
  });

  it('works when size does not equal the sum of allSizes values', () => {
    // percentage does not validate — it divides whatever is passed
    const result = percentage(200, { TypeScript: 100 });
    expect(result).toEqual({ TypeScript: 0.5 });
  });
});

describe('getSize (default export)', () => {
  it('computes correct percentages for a typical multi-language input', () => {
    const result = getSize([
      { TypeScript: 5000, JavaScript: 3000, CSS: 2000 },
    ]);
    expect(result).toEqual({ TypeScript: 0.5, JavaScript: 0.3, CSS: 0.2 });
  });

  it('returns an empty object for an empty input array', () => {
    expect(getSize([])).toEqual({});
  });

  it('returns 1 for a single repo with a single language', () => {
    expect(getSize([{ Rust: 9999 }])).toEqual({ Rust: 1 });
  });

  it('aggregates the same language across multiple repo records before computing percentages', () => {
    // Repo A: TypeScript 3000; Repo B: TypeScript 2000, JavaScript 5000
    // Merged: TypeScript 5000, JavaScript 5000 → total 10000 → each 0.5
    const result = getSize([
      { TypeScript: 3000 },
      { TypeScript: 2000, JavaScript: 5000 },
    ]);
    expect(result).toEqual({ TypeScript: 0.5, JavaScript: 0.5 });
  });

  it('handles a three-record input where percentages sum to 1', () => {
    const result = getSize([
      { Python: 2000 },
      { Ruby: 1000 },
      { Go: 7000 },
    ]);
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
    expect(result.Go).toBeCloseTo(0.7);
    expect(result.Python).toBeCloseTo(0.2);
    expect(result.Ruby).toBeCloseTo(0.1);
  });

  it('returns an empty object when all values are 0', () => {
    // totalSize = 0 → percentage returns {}
    expect(getSize([{ TypeScript: 0 }])).toEqual({});
  });
});

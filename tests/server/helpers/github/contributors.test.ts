import { describe, it, expect } from 'vitest';
import {
  accumulateFileLanguages,
  getExtension,
  getFileChanges,
  mergeLanguageCounts,
} from '../../../../server/helpers/github/contributors';
import type { CommitFile } from '../../../../server/helpers/github/contributors';

describe('getExtension', () => {
  it('returns .ts for a TypeScript file', () => {
    expect(getExtension('index.ts')).toBe('.ts');
  });

  it('returns .js for a JavaScript file', () => {
    expect(getExtension('app.js')).toBe('.js');
  });

  it('returns .dockerfile for a bare Dockerfile (no extension)', () => {
    expect(getExtension('Dockerfile')).toBe('.dockerfile');
  });

  it('returns .dockerfile for Dockerfile in a subdirectory', () => {
    expect(getExtension('docker/Dockerfile')).toBe('.dockerfile');
  });

  it('returns empty string for Makefile (extensionless, not Dockerfile)', () => {
    expect(getExtension('Makefile')).toBe('');
  });

  it('returns empty string for a file with no extension', () => {
    expect(getExtension('no-ext-file')).toBe('');
  });

  it('returns .py for a Python file in a nested path', () => {
    expect(getExtension('path/to/file.py')).toBe('.py');
  });

  it('lowercases the extension (.TSX → .tsx)', () => {
    expect(getExtension('Component.TSX')).toBe('.tsx');
  });

  it('lowercases the extension (.TS → .ts)', () => {
    expect(getExtension('utils.TS')).toBe('.ts');
  });

  it('handles files with multiple dots by returning the last extension', () => {
    expect(getExtension('archive.tar.gz')).toBe('.gz');
  });

  it('handles a dot-file with no trailing extension (e.g. .gitignore)', () => {
    // lastIndexOf('.') = 0, so slice returns '.gitignore' — it has a "dot"
    expect(getExtension('.gitignore')).toBe('.gitignore');
  });
});

describe('getFileChanges', () => {
  it('sums additions and deletions when both are present', () => {
    const file: CommitFile = { filename: 'a.ts', additions: 10, deletions: 5 };
    expect(getFileChanges(file)).toBe(15);
  });

  it('returns only additions when deletions is 0', () => {
    const file: CommitFile = { filename: 'a.ts', additions: 7, deletions: 0 };
    expect(getFileChanges(file)).toBe(7);
  });

  it('returns only deletions when additions is 0', () => {
    const file: CommitFile = { filename: 'a.ts', additions: 0, deletions: 4 };
    expect(getFileChanges(file)).toBe(4);
  });

  it('returns 0 when both additions and deletions are 0', () => {
    const file: CommitFile = { filename: 'a.ts', additions: 0, deletions: 0 };
    expect(getFileChanges(file)).toBe(0);
  });

  it('returns 0 when additions and deletions are both undefined', () => {
    const file: CommitFile = { filename: 'a.ts' };
    expect(getFileChanges(file)).toBe(0);
  });

  it('treats undefined additions as 0 and counts deletions', () => {
    const file: CommitFile = { filename: 'a.ts', deletions: 8 };
    expect(getFileChanges(file)).toBe(8);
  });

  it('treats undefined deletions as 0 and counts additions', () => {
    const file: CommitFile = { filename: 'a.ts', additions: 12 };
    expect(getFileChanges(file)).toBe(12);
  });

  it('handles large numbers correctly', () => {
    const file: CommitFile = {
      filename: 'big.ts',
      additions: 99999,
      deletions: 1,
    };
    expect(getFileChanges(file)).toBe(100000);
  });
});

describe('accumulateFileLanguages', () => {
  it('returns an empty object for an empty file list', () => {
    expect(accumulateFileLanguages([])).toEqual({});
  });

  it('maps a single known TypeScript file to a language count', () => {
    const files: CommitFile[] = [
      { filename: 'index.ts', additions: 50, deletions: 10 },
    ];
    expect(accumulateFileLanguages(files)).toEqual({ TypeScript: 60 });
  });

  it('maps multiple files with different languages', () => {
    const files: CommitFile[] = [
      { filename: 'app.ts', additions: 100, deletions: 0 },
      { filename: 'styles.css', additions: 20, deletions: 5 },
      { filename: 'index.py', additions: 30, deletions: 10 },
    ];
    expect(accumulateFileLanguages(files)).toEqual({
      TypeScript: 100,
      CSS: 25,
      Python: 40,
    });
  });

  it('sums changes for files that map to the same language', () => {
    const files: CommitFile[] = [
      { filename: 'a.ts', additions: 100, deletions: 0 },
      { filename: 'b.ts', additions: 50, deletions: 20 },
      { filename: 'c.tsx', additions: 30, deletions: 10 },
    ];
    // All map to TypeScript
    expect(accumulateFileLanguages(files)).toEqual({ TypeScript: 210 });
  });

  it('skips files with unknown extensions', () => {
    const files: CommitFile[] = [
      { filename: 'config.unknown', additions: 100, deletions: 50 },
      { filename: 'data.xyz', additions: 200, deletions: 100 },
    ];
    expect(accumulateFileLanguages(files)).toEqual({});
  });

  it('skips files with no extension that are not Dockerfile', () => {
    const files: CommitFile[] = [
      { filename: 'Makefile', additions: 10, deletions: 0 },
      { filename: 'LICENSE', additions: 5, deletions: 0 },
    ];
    expect(accumulateFileLanguages(files)).toEqual({});
  });

  it('correctly handles a Dockerfile (extensionless but known)', () => {
    const files: CommitFile[] = [
      { filename: 'Dockerfile', additions: 15, deletions: 3 },
    ];
    expect(accumulateFileLanguages(files)).toEqual({ Dockerfile: 18 });
  });

  it('mixes known and unknown extension files, skipping unknown ones', () => {
    const files: CommitFile[] = [
      { filename: 'main.go', additions: 200, deletions: 50 },
      { filename: 'notes.txt', additions: 10, deletions: 2 },
      { filename: 'README.md', additions: 5, deletions: 1 },
    ];
    expect(accumulateFileLanguages(files)).toEqual({ Go: 250, Markdown: 6 });
  });

  it('counts files with 0 changes as 0 contribution to the total', () => {
    const files: CommitFile[] = [
      { filename: 'a.ts', additions: 0, deletions: 0 },
      { filename: 'b.ts', additions: 10, deletions: 5 },
    ];
    expect(accumulateFileLanguages(files)).toEqual({ TypeScript: 15 });
  });
});

describe('mergeLanguageCounts', () => {
  it('merges source keys into an empty target', () => {
    const target: Record<string, number> = {};
    const source = { TypeScript: 500, JavaScript: 200 };
    mergeLanguageCounts(target, source);
    expect(target).toEqual({ TypeScript: 500, JavaScript: 200 });
  });

  it('sums values for overlapping keys', () => {
    const target = { TypeScript: 300, CSS: 100 };
    const source = { TypeScript: 200, JavaScript: 50 };
    mergeLanguageCounts(target, source);
    expect(target).toEqual({ TypeScript: 500, CSS: 100, JavaScript: 50 });
  });

  it('adds non-overlapping keys from source without touching existing target keys', () => {
    const target = { Go: 1000 };
    const source = { Rust: 500 };
    mergeLanguageCounts(target, source);
    expect(target).toEqual({ Go: 1000, Rust: 500 });
  });

  it('does not mutate the source object', () => {
    const target: Record<string, number> = {};
    const source = { Python: 800 };
    mergeLanguageCounts(target, source);
    expect(source).toEqual({ Python: 800 });
  });

  it('is a no-op when source is empty', () => {
    const target = { TypeScript: 100 };
    mergeLanguageCounts(target, {});
    expect(target).toEqual({ TypeScript: 100 });
  });

  it('handles merging an empty source into an empty target', () => {
    const target: Record<string, number> = {};
    mergeLanguageCounts(target, {});
    expect(target).toEqual({});
  });

  it('accumulates correctly across multiple sequential merges', () => {
    const target: Record<string, number> = {};
    mergeLanguageCounts(target, { TypeScript: 100, Python: 50 });
    mergeLanguageCounts(target, { TypeScript: 200 });
    mergeLanguageCounts(target, { Python: 75, Go: 300 });
    expect(target).toEqual({ TypeScript: 300, Python: 125, Go: 300 });
  });
});

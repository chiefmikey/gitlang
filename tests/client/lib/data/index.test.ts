import { describe, it, expect } from 'vitest';
import {
  buildLangRepoBreakdown,
  parseEntry,
  parseOwnerName,
} from '../../../../client/lib/data/index';

describe('parseOwnerName', () => {
  it('returns a plain username unchanged', () => {
    expect(parseOwnerName('torvalds')).toBe('torvalds');
  });

  it('strips leading @ from an org handle', () => {
    expect(parseOwnerName('@angular')).toBe('angular');
  });

  it('strips the org: prefix', () => {
    expect(parseOwnerName('org:angular')).toBe('angular');
  });

  it('strips the org/ prefix', () => {
    expect(parseOwnerName('org/angular')).toBe('angular');
  });

  it('returns an empty string unchanged', () => {
    expect(parseOwnerName('')).toBe('');
  });

  it('does not strip a plain slash — only the org/ prefix', () => {
    // A value without the "org/" prefix should be returned as-is
    expect(parseOwnerName('myname')).toBe('myname');
  });

  it('handles a username that starts with org but has no colon or slash separator', () => {
    expect(parseOwnerName('orgname')).toBe('orgname');
  });
});

describe('parseEntry', () => {
  it('parses a plain username with no repos and no author', () => {
    expect(parseEntry('torvalds')).toEqual({
      owner: 'torvalds',
      repos: null,
      author: null,
    });
  });

  it('parses user/repo into owner and a single-element repos array', () => {
    expect(parseEntry('user/repo')).toEqual({
      owner: 'user',
      repos: ['repo'],
      author: null,
    });
  });

  it('parses user/repo1,repo2,repo3 into owner and multiple repos', () => {
    expect(parseEntry('user/repo1,repo2,repo3')).toEqual({
      owner: 'user',
      repos: ['repo1', 'repo2', 'repo3'],
      author: null,
    });
  });

  it('parses an @org handle into owner with no repos and no author', () => {
    expect(parseEntry('@angular')).toEqual({
      owner: 'angular',
      repos: null,
      author: null,
    });
  });

  it('parses user/repo@author into owner, repos, and author', () => {
    expect(parseEntry('user/repo@contributor')).toEqual({
      owner: 'user',
      repos: ['repo'],
      author: 'contributor',
    });
  });

  it('parses org:name into owner with no repos and no author', () => {
    expect(parseEntry('org:angular')).toEqual({
      owner: 'angular',
      repos: null,
      author: null,
    });
  });

  it('ignores @ at position 0 for author extraction — treats it as org prefix, not author', () => {
    // lastIndexOf('@') returns 0, which is not > 0, so no author is extracted
    const result = parseEntry('@myorg');
    expect(result.author).toBeNull();
    expect(result.owner).toBe('myorg');
  });

  it('parses user/repo1,repo2@author with multiple repos and an author', () => {
    expect(parseEntry('user/repo1,repo2@author')).toEqual({
      owner: 'user',
      repos: ['repo1', 'repo2'],
      author: 'author',
    });
  });

  it('handles trailing comma gracefully — filters empty repo names', () => {
    const result = parseEntry('user/repo1,');
    expect(result.owner).toBe('user');
    // Empty string after trailing comma is filtered out
    expect(result.repos).toEqual(['repo1']);
  });

  it('parses org:name format (as plain username, no slash path)', () => {
    // "org:google" has no slash so goes through the plain-username path
    // parseOwnerName strips the "org:" prefix → owner becomes "google"
    expect(parseEntry('org:google')).toEqual({
      owner: 'google',
      repos: null,
      author: null,
    });
  });
});

describe('buildLangRepoBreakdown', () => {
  it('returns an empty object for an empty input array', () => {
    expect(buildLangRepoBreakdown([])).toEqual({});
  });

  it('gives each language a 100% entry when there is only one repo', () => {
    const repoLangs = [
      { name: 'my-repo', langs: { TypeScript: 8000, CSS: 2000 } },
    ];
    const result = buildLangRepoBreakdown(repoLangs);

    expect(result['TypeScript']).toEqual([{ repo: 'my-repo', percent: 1 }]);
    expect(result['CSS']).toEqual([{ repo: 'my-repo', percent: 1 }]);
  });

  it('distributes percentages correctly across two repos sharing a language', () => {
    const repoLangs = [
      { name: 'repo-a', langs: { TypeScript: 6000 } },
      { name: 'repo-b', langs: { TypeScript: 4000 } },
    ];
    const result = buildLangRepoBreakdown(repoLangs);

    expect(result['TypeScript']).toHaveLength(2);
    // repo-a has 6000/10000 = 0.6, repo-b has 4000/10000 = 0.4
    expect(result['TypeScript'][0]).toEqual({ repo: 'repo-a', percent: 0.6 });
    expect(result['TypeScript'][1]).toEqual({ repo: 'repo-b', percent: 0.4 });
  });

  it('sorts repos within each language by percent descending', () => {
    const repoLangs = [
      { name: 'small', langs: { Go: 1000 } },
      { name: 'large', langs: { Go: 9000 } },
    ];
    const result = buildLangRepoBreakdown(repoLangs);

    expect(result['Go'][0].repo).toBe('large');
    expect(result['Go'][1].repo).toBe('small');
  });

  it('handles multiple repos each contributing different languages', () => {
    const repoLangs = [
      { name: 'frontend', langs: { TypeScript: 5000, CSS: 2000 } },
      { name: 'backend', langs: { TypeScript: 3000, Go: 8000 } },
    ];
    const result = buildLangRepoBreakdown(repoLangs);

    // TypeScript: 5000+3000 = 8000 total; frontend: 5000/8000=0.625, backend: 3000/8000=0.375
    expect(result['TypeScript']).toHaveLength(2);
    expect(result['TypeScript'][0].repo).toBe('frontend');
    expect(result['TypeScript'][0].percent).toBeCloseTo(0.625);
    expect(result['TypeScript'][1].repo).toBe('backend');
    expect(result['TypeScript'][1].percent).toBeCloseTo(0.375);

    // CSS: only in frontend → 100%
    expect(result['CSS']).toEqual([{ repo: 'frontend', percent: 1 }]);

    // Go: only in backend → 100%
    expect(result['Go']).toEqual([{ repo: 'backend', percent: 1 }]);
  });

  it('returns 0 percent for a language when total bytes is 0', () => {
    const repoLangs = [{ name: 'empty-repo', langs: { Rust: 0 } }];
    const result = buildLangRepoBreakdown(repoLangs);

    // total = 0, so percent = 0 per the implementation
    expect(result['Rust']).toEqual([{ repo: 'empty-repo', percent: 0 }]);
  });

  it('accumulates bytes for a single language spread across three repos', () => {
    const repoLangs = [
      { name: 'a', langs: { Python: 1000 } },
      { name: 'b', langs: { Python: 2000 } },
      { name: 'c', langs: { Python: 7000 } },
    ];
    const result = buildLangRepoBreakdown(repoLangs);

    expect(result['Python']).toHaveLength(3);
    // Sorted desc by percent: c (70%), b (20%), a (10%)
    expect(result['Python'][0]).toEqual({ repo: 'c', percent: 0.7 });
    expect(result['Python'][1]).toEqual({ repo: 'b', percent: 0.2 });
    expect(result['Python'][2]).toEqual({ repo: 'a', percent: 0.1 });
  });

  it('handles a repo with an empty langs object without crashing', () => {
    const repoLangs = [
      { name: 'no-lang', langs: {} },
      { name: 'with-lang', langs: { Ruby: 5000 } },
    ];
    const result = buildLangRepoBreakdown(repoLangs);

    // 'no-lang' contributes nothing; Ruby entirely from 'with-lang'
    expect(result['Ruby']).toEqual([{ repo: 'with-lang', percent: 1 }]);
    expect(Object.keys(result)).toEqual(['Ruby']);
  });
});

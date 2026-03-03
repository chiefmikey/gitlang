import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListLanguages = vi.fn();

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(function () {
    return {
      rest: {
        repos: {
          listLanguages: mockListLanguages,
        },
      },
    };
  }),
}));

import languages from '../../../../server/helpers/github/languages';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('languages', () => {
  it('returns empty objects for each repo when token is empty', async () => {
    const result = await languages('torvalds', ['repo1', 'repo2'], '');
    expect(result).toEqual([{}, {}]);
    expect(mockListLanguages).not.toHaveBeenCalled();
  });

  it('returns an empty array when repo list is empty', async () => {
    const result = await languages('torvalds', [], 'ghs_token');
    expect(result).toEqual([]);
    expect(mockListLanguages).not.toHaveBeenCalled();
  });

  it('returns language data for each repo', async () => {
    mockListLanguages
      .mockResolvedValueOnce({ data: { TypeScript: 5000, JavaScript: 1000 } })
      .mockResolvedValueOnce({ data: { Python: 3000 } });

    const result = await languages('torvalds', ['repo1', 'repo2'], 'ghs_token');

    expect(mockListLanguages).toHaveBeenCalledTimes(2);
    expect(mockListLanguages).toHaveBeenCalledWith({
      owner: 'torvalds',
      repo: 'repo1',
    });
    expect(mockListLanguages).toHaveBeenCalledWith({
      owner: 'torvalds',
      repo: 'repo2',
    });
    expect(result).toEqual([
      { TypeScript: 5000, JavaScript: 1000 },
      { Python: 3000 },
    ]);
  });

  it('returns empty object for a repo that errors while others succeed', async () => {
    mockListLanguages
      .mockResolvedValueOnce({ data: { TypeScript: 5000 } })
      .mockRejectedValueOnce(new Error('Not Found'))
      .mockResolvedValueOnce({ data: { Go: 2000 } });

    const result = await languages(
      'torvalds',
      ['repo1', 'bad-repo', 'repo3'],
      'ghs_token',
    );

    expect(result).toEqual([{ TypeScript: 5000 }, {}, { Go: 2000 }]);
  });

  it('returns a single language record for a single repo', async () => {
    mockListLanguages.mockResolvedValue({ data: { Rust: 8000 } });

    const result = await languages('burntsushi', ['ripgrep'], 'ghs_token');

    expect(result).toEqual([{ Rust: 8000 }]);
  });
});

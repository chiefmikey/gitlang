import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPaginate = vi.fn();

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(function () {
    return {
      paginate: mockPaginate,
      rest: {
        repos: {
          listForUser: 'listForUser',
          listForOrg: 'listForOrg',
        },
      },
    };
  }),
}));

import repositories, {
  isOrganization,
  parseOrgName,
} from '../../../../server/helpers/github/repositories';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isOrganization', () => {
  it('returns true for @org prefix', () => {
    expect(isOrganization('@angular')).toBe(true);
  });

  it('returns true for org: prefix', () => {
    expect(isOrganization('org:angular')).toBe(true);
  });

  it('returns true for org/ prefix', () => {
    expect(isOrganization('org/angular')).toBe(true);
  });

  it('returns false for a plain username', () => {
    expect(isOrganization('torvalds')).toBe(false);
  });

  it('returns false for username that contains org elsewhere', () => {
    expect(isOrganization('myorg')).toBe(false);
  });
});

describe('parseOrgName', () => {
  it('strips @ prefix', () => {
    expect(parseOrgName('@angular')).toBe('angular');
  });

  it('strips org: prefix', () => {
    expect(parseOrgName('org:angular')).toBe('angular');
  });

  it('strips org/ prefix', () => {
    expect(parseOrgName('org/angular')).toBe('angular');
  });

  it('returns plain username unchanged', () => {
    expect(parseOrgName('torvalds')).toBe('torvalds');
  });
});

describe('repositories', () => {
  it('returns empty array when token is empty', async () => {
    const result = await repositories('torvalds', '');
    expect(result).toEqual([]);
    expect(mockPaginate).not.toHaveBeenCalled();
  });

  it('calls listForUser for a regular username', async () => {
    mockPaginate.mockResolvedValue(['repo1', 'repo2']);

    const result = await repositories('torvalds', 'ghs_token');

    expect(mockPaginate).toHaveBeenCalledTimes(1);
    expect(mockPaginate).toHaveBeenCalledWith(
      'listForUser',
      expect.objectContaining({ username: 'torvalds' }),
      expect.any(Function),
    );
    expect(result).toEqual(['repo1', 'repo2']);
  });

  it('calls listForOrg for @org prefix', async () => {
    mockPaginate.mockResolvedValue(['repo-a', 'repo-b']);

    const result = await repositories('@angular', 'ghs_token');

    expect(mockPaginate).toHaveBeenCalledTimes(1);
    expect(mockPaginate).toHaveBeenCalledWith(
      'listForOrg',
      expect.objectContaining({ org: 'angular' }),
      expect.any(Function),
    );
    expect(result).toEqual(['repo-a', 'repo-b']);
  });

  it('calls listForOrg for org: prefix', async () => {
    mockPaginate.mockResolvedValue(['repo-x']);

    await repositories('org:vercel', 'ghs_token');

    expect(mockPaginate).toHaveBeenCalledWith(
      'listForOrg',
      expect.objectContaining({ org: 'vercel' }),
      expect.any(Function),
    );
  });

  it('returns empty array when paginate throws', async () => {
    mockPaginate.mockRejectedValue(new Error('Network error'));

    const result = await repositories('torvalds', 'ghs_token');
    expect(result).toEqual([]);
  });
});

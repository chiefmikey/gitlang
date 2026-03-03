import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(function () {
    return {
      rest: {
        rateLimit: {
          get: mockGet,
        },
      },
    };
  }),
}));

import rateLimit from '../../../../server/helpers/github/rateLimit';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rateLimit', () => {
  it('returns undefined when token is empty', async () => {
    const result = await rateLimit('');
    expect(result).toBeUndefined();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns rate limit info on success', async () => {
    mockGet.mockResolvedValue({
      data: {
        rate: {
          limit: 5000,
          remaining: 4800,
          reset: 1700000000,
          used: 200,
        },
      },
    });

    const result = await rateLimit('ghs_token');

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      limit: 5000,
      remaining: 4800,
      reset: 1700000000,
      used: 200,
    });
  });

  it('returns undefined when the API call throws', async () => {
    mockGet.mockRejectedValue(new Error('Unauthorized'));

    const result = await rateLimit('ghs_bad_token');
    expect(result).toBeUndefined();
  });

  it('returns 0 values correctly when rate limit is exhausted', async () => {
    mockGet.mockResolvedValue({
      data: {
        rate: {
          limit: 5000,
          remaining: 0,
          reset: 1700000000,
          used: 5000,
        },
      },
    });

    const result = await rateLimit('ghs_token');
    expect(result).toEqual({
      limit: 5000,
      remaining: 0,
      reset: 1700000000,
      used: 5000,
    });
  });
});

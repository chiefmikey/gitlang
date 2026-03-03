import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../server/helpers/github/auth', () => ({
  default: vi.fn().mockResolvedValue('test-token'),
}));

import { getToken } from '../../../../server/helpers/github/tokenManager';
import auth from '../../../../server/helpers/github/auth';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getToken', () => {
  it('delegates to auth and returns the token', async () => {
    const token = await getToken();
    expect(auth).toHaveBeenCalledTimes(1);
    expect(token).toBe('test-token');
  });

  it('returns whatever auth resolves to', async () => {
    vi.mocked(auth).mockResolvedValueOnce('different-token');

    const token = await getToken();
    expect(token).toBe('different-token');
  });

  it('propagates rejection from auth', async () => {
    vi.mocked(auth).mockRejectedValueOnce(new Error('Auth failed'));

    await expect(getToken()).rejects.toThrow('Auth failed');
  });
});

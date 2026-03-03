import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => {
  const mockAxios = {
    get: vi.fn(),
    isAxiosError: vi.fn((e) => e.isAxiosError === true),
  };
  return { default: mockAxios };
});

import axios from 'axios';
import repositories from '../../../../../client/lib/data/requests/repositories';

const BASE = 'http://localhost:3000/gitlang/github';

describe('repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns repo list on success', async () => {
    (axios.get as any).mockResolvedValue({ data: ['repo1', 'repo2'] });

    const result = await repositories('testuser');

    expect(result).toEqual(['repo1', 'repo2']);
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/repos`, {
      params: { username: 'testuser' },
    });
  });

  it('returns empty array when response data is empty', async () => {
    (axios.get as any).mockResolvedValue({ data: [] });

    const result = await repositories('testuser');

    expect(result).toEqual([]);
  });

  it('passes includeForks param when true', async () => {
    (axios.get as any).mockResolvedValue({ data: ['repo1'] });

    await repositories('testuser', true);

    expect(axios.get).toHaveBeenCalledWith(`${BASE}/repos`, {
      params: { username: 'testuser', includeForks: 'true' },
    });
  });

  it('throws on error', async () => {
    const error = new Error('Network error');
    (axios.get as any).mockRejectedValue(error);

    await expect(repositories('testuser')).rejects.toThrow('Network error');
  });
});

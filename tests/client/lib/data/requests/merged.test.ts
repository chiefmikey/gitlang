import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => {
  const mockAxios = {
    get: vi.fn(),
    isAxiosError: vi.fn((e) => e.isAxiosError === true),
  };
  return { default: mockAxios };
});

import axios from 'axios';
import merged from '../../../../../client/lib/data/requests/merged';

const BASE = 'http://localhost:3000/gitlang/github';

describe('merged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns merged data on success', async () => {
    const mergedData = {
      repos: ['repo1', 'repo2'],
      langs: [{ TypeScript: 1200 }, { CSS: 400 }],
    };
    (axios.get as any).mockResolvedValue({ data: mergedData });

    const result = await merged('testuser');

    expect(result).toEqual(mergedData);
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/merged`, {
      params: { username: 'testuser' },
    });
  });

  it('throws RATE_LIMIT error on 429 response', async () => {
    const axiosError = { isAxiosError: true, response: { status: 429 } };
    (axios.get as any).mockRejectedValue(axiosError);
    (axios.isAxiosError as any).mockReturnValue(true);

    await expect(merged('testuser')).rejects.toThrow('API rate limit reached');
  });

  it('throws on other errors', async () => {
    const error = new Error('Network failure');
    (axios.get as any).mockRejectedValue(error);
    (axios.isAxiosError as any).mockReturnValue(false);

    await expect(merged('testuser')).rejects.toThrow('Network failure');
  });
});

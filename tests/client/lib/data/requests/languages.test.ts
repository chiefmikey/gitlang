import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => {
  const mockAxios = {
    get: vi.fn(),
    isAxiosError: vi.fn((e) => e.isAxiosError === true),
  };
  return { default: mockAxios };
});

import axios from 'axios';
import languages from '../../../../../client/lib/data/requests/languages';

const BASE = 'http://localhost:3000/gitlang/github';

describe('languages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns language data on success', async () => {
    const langData = [{ TypeScript: 1200, CSS: 400 }];
    (axios.get as any).mockResolvedValue({ data: langData });

    const result = await languages('owner', ['repo1']);

    expect(result).toEqual(langData);
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/langs`, {
      params: { owner: 'owner', repos: JSON.stringify(['repo1']) },
    });
  });

  it('returns empty array when response data is empty', async () => {
    (axios.get as any).mockResolvedValue({ data: [] });

    const result = await languages('owner', ['repo1']);

    expect(result).toEqual([]);
  });

  it('throws RATE_LIMIT error on 429 response', async () => {
    const axiosError = { isAxiosError: true, response: { status: 429 } };
    (axios.get as any).mockRejectedValue(axiosError);
    (axios.isAxiosError as any).mockReturnValue(true);

    await expect(languages('owner', ['repo1'])).rejects.toThrow(
      'API rate limit reached',
    );
  });

  it('throws original error on other errors', async () => {
    const error = new Error('Server error');
    (axios.get as any).mockRejectedValue(error);
    (axios.isAxiosError as any).mockReturnValue(false);

    await expect(languages('owner', ['repo1'])).rejects.toThrow('Server error');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => {
  const mockAxios = {
    get: vi.fn(),
    isAxiosError: vi.fn((e) => e.isAxiosError === true),
  };
  return { default: mockAxios };
});

import axios from 'axios';
import {
  contributors,
  contributorLanguages,
} from '../../../../../client/lib/data/requests/contributors';

const BASE = 'http://localhost:3000/gitlang/github';

describe('contributors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list on success', async () => {
    const contributorList = [
      { login: 'alice', contributions: 42, avatar_url: 'https://example.com/alice.png' },
      { login: 'bob', contributions: 17, avatar_url: 'https://example.com/bob.png' },
    ];
    (axios.get as any).mockResolvedValue({ data: contributorList });

    const result = await contributors('owner', 'repo1');

    expect(result).toEqual(contributorList);
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/contributors`, {
      params: { owner: 'owner', repo: 'repo1' },
    });
  });

  it('returns empty array on error', async () => {
    (axios.get as any).mockRejectedValue(new Error('Network error'));

    const result = await contributors('owner', 'repo1');

    expect(result).toEqual([]);
  });
});

describe('contributorLanguages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns language data on success', async () => {
    const langData = { TypeScript: 800, CSS: 200 };
    (axios.get as any).mockResolvedValue({ data: langData });

    const result = await contributorLanguages('owner', 'repo1', 'alice');

    expect(result).toEqual(langData);
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/contributor-langs`, {
      params: { owner: 'owner', repo: 'repo1', author: 'alice' },
    });
  });

  it('returns empty object on error', async () => {
    (axios.get as any).mockRejectedValue(new Error('Network error'));

    const result = await contributorLanguages('owner', 'repo1', 'alice');

    expect(result).toEqual({});
  });
});

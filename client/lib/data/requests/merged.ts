import axios, { type AxiosResponse } from 'axios';

import { ERROR, ROUTES } from '../constants';

type LanguageData = Record<string, number>;

interface MergedResponse {
  repos: string[];
  langs: LanguageData[];
}

const merged = async (
  username: string,
  includeForks = false,
): Promise<MergedResponse> => {
  try {
    const response: AxiosResponse<MergedResponse> = await axios.get(
      ROUTES.MERGED,
      {
        params: { username, includeForks: String(includeForks) },
      },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new Error(ERROR.RATE_LIMIT);
    }
    console.error('Error fetching merged data', error);
    throw error;
  }
};

export default merged;

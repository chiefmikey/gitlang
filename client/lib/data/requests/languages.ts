import axios, { type AxiosResponse } from 'axios';

import { ERROR, ROUTES } from '../constants';

type LanguageData = Record<string, number>;

const languages = async (
  owner: string,
  repos: string[],
): Promise<LanguageData[]> => {
  try {
    const response: AxiosResponse<LanguageData[]> = await axios.get(
      ROUTES.LANGS,
      {
        params: {
          owner,
          repos: JSON.stringify(repos),
        },
      },
    );
    return response.data.length > 0 ? response.data : [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new Error(ERROR.RATE_LIMIT);
    }
    console.error('Error fetching languages', error);
    throw error;
  }
};

export default languages;

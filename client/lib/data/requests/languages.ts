import axios, { AxiosResponse } from 'axios';

import { ROUTES } from '../constants';

interface LanguageData {
  [key: string]: number;
}

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
    console.error('Error getting token from auth api', error);
    throw error;
  }
};

export default languages;

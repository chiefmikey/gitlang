import axios from 'axios';

import { ROUTES } from '../../constants';

const languages = async (owner: string, repos: string[]) => {
  try {
    const allLanguages: { data: { [key: string]: number }[] } = await axios.get(
      ROUTES.LANGS,
      {
        params: {
          owner,
          repos: JSON.stringify(repos),
        },
      },
    );
    if (allLanguages.data.length > 0) {
      return allLanguages.data;
    }
    return [];
  } catch (error) {
    console.error('Error getting token from auth api', error);
    return [];
  }
};

export default languages;

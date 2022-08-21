import axios from 'axios';

import router from '../../../local';

const localToken = process.env.GH_PAT;

const localApi = async (owner: string, repos: string[]) => {
  try {
    const allLanguages = JSON.parse(
      await router.langs(owner, repos, localToken),
    );

    if (allLanguages && allLanguages.length > 0) {
      return allLanguages;
    }
    return [];
  } catch (error) {
    console.error('Error getting token from auth api', error);
    return [];
  }
};

const serverApi = async (owner: string, repos: string[]) => {
  try {
    const allLanguages: { data: { [key: string]: number }[] } = await axios.get(
      'https://api.5105015032.com/gitlang/github/langs',
      {
        params: {
          owner,
          repos: JSON.stringify(repos),
        },
      },
    );
    if (allLanguages && allLanguages.data && allLanguages.data.length > 0)
      return allLanguages.data;
    return [];
  } catch (error) {
    console.error('Error getting token from auth api', error);
    return [];
  }
};

const languages = localToken ? localApi : serverApi;

export default languages;

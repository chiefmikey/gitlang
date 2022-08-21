import axios from 'axios';

import router from '../../../local';

const localToken = process.env.GH_PAT;

const localApi = async (username: string) => {
  try {
    const allRepos = JSON.parse(await router.repos(username, localToken));
    if (allRepos && allRepos.length > 0) {
      return allRepos;
    }
    return [];
  } catch (error) {
    console.error('Error getting token from auth api', error);
    return [];
  }
};

const serverApi = async (username: string) => {
  try {
    const allRepos: { data: [] } = await axios.get(
      'https://api.5105015032.com/gitlang/github/repos',
      {
        params: { username },
      },
    );
    if (allRepos && allRepos.data && allRepos.data.length > 0) {
      return allRepos.data;
    }
    return [];
  } catch (error) {
    console.error('Error getting token from auth api', error);
    return [];
  }
};

const repositories = localToken ? localApi : serverApi;

export default repositories;

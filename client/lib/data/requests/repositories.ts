import axios from 'axios';

import { ROUTES } from '../constants';

const repositories = async (username: string) => {
  try {
    const allRepos: { data: [] } = await axios.get(ROUTES.REPOS, {
      params: { username },
    });
    if (allRepos.data.length > 0) {
      return allRepos.data;
    }
    return [];
  } catch (error) {
    console.error('Error getting token from auth api', error);
    return [];
  }
};

export default repositories;

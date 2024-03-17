import axios from 'axios';

import { ROUTES } from '../../../constants';

const { protocol, hostname } = window.location;
const isLocal = hostname === 'localhost';

const localApi = async (username: string) => {
  try {
    const allRepos: { data: [] } = await axios.get(
      `${protocol}//${hostname}${ROUTES.REPOS_LOCAL}`,
      {
        params: { username },
      },
    );
    if (allRepos.data.length > 0) {
      return allRepos.data;
    }
    return [];
  } catch (error) {
    console.error('Error getting token from auth api', error);
    return [];
  }
};

const serverApi = async (username: string) => {
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

const repositories = isLocal ? localApi : serverApi;

export default repositories;

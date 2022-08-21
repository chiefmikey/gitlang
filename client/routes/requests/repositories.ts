import axios from 'axios';

const { protocol, hostname } = window.location;
const isLocal = hostname !== 'gitlang.net';
console.log('hostname:', hostname);

const localApi = async (username: string) => {
  try {
    const allRepos: { data: [] } = await axios.get(
      `${protocol}//${hostname}:3000/gitlang/github/repos`,
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

const repositories = isLocal ? localApi : serverApi;

export default repositories;

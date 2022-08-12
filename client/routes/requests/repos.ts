import axios from 'axios';

const repos = async (username: string) => {
  try {
    const allRepos: { data: [] } = await axios.get(
      'https://api.5105015032.com/auth/gitlang/repos',
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

export default repos;

import axios from 'axios';

const repos = async (owner: string) => {
  try {
    const allRepos: { data: [] } = JSON.parse(
      await axios.get('https://api.5105015032.com/auth/gitlang/repos', {
        params: { owner },
      }),
    );
    if (allRepos && allRepos.data && allRepos.data.length > 0) {
      return allRepos.data;
    }
    return [];
  } catch (error) {
    console.log('Error getting token from auth api', error);
    return [];
  }
};

export default repos;

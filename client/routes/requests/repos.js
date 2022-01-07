import axios from 'axios';

const repos = async (owner) => {
  try {
    const allRepos = await axios.get(
      'https://5105015032.com/auth/gitlang/repos',
      {
        owner,
      },
    );
    if (allRepos && allRepos.data && allRepos.data.length > 0)
      return allRepos.data;
    return [];
  } catch (error) {
    console.log('Error getting token from auth api', error);
    return [];
  }
};

export default repos;

import axios from 'axios';

const languages = async (owner: string, repos: string[]) => {
  try {
    const allLanguages: { data: [] } = await axios.get(
      'https://5105015032.com/auth/gitlang/langs',
      {
        params: {
          owner,
          repos,
        },
      },
    );
    if (allLanguages && allLanguages.data && allLanguages.data.length > 0)
      return allLanguages.data;
    return [];
  } catch (error) {
    console.log('Error getting token from auth api', error);
    return [];
  }
};

export default languages;

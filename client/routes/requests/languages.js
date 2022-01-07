import axios from 'axios';

const languages = async (owner, repos) => {
  try {
    const allLanguages = await axios.get(
      'https://5105015032.com/auth/gitlang/languages',
      {
        owner,
        repos,
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

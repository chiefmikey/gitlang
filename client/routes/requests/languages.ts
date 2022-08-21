import axios from 'axios';

const { protocol, hostname } = window.location;
const isLocal = hostname !== 'gitlang.net';

const localApi = async (owner: string, repos: string[]) => {
  try {
    const allLanguages: { data: { [key: string]: number }[] } = await axios.get(
      `${protocol}//${hostname}:3000/gitlang/github/langs`,
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

const languages = isLocal ? localApi : serverApi;

export default languages;

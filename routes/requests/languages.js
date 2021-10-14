import axios from 'axios';
import token from '../../token.js';

const fetchLanguage = async (owner, repo) => {
  try {
    const options = {
      url: `https://api.github.com/repos/${owner}/${repo}/languages`,
      method: 'get',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${process.env.TOKEN || token()}`,
      },
    };
    const res = await axios(options);
    if (res.data) {
      return res.data;
    }
    return {};
  } catch (e) {
    return e;
  }
};

const getLanguages = async (owner, names) => {
  const languages = [];
  for (let i = 0; i < names.length; i += 1) {
    const repo = names[i];
    languages.push(fetchLanguage(owner, repo));
  }
  // eslint-disable-next-line compat/compat
  return Promise.all(languages);
};

export default getLanguages;

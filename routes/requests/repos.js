import axios from 'axios';
import token from '../../token.js';

const getRepos = async (owner) => {
  try {
    const options = {
      url: `https://api.github.com/users/${owner}/repos`,
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

export default getRepos;

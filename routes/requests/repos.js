import axios from 'axios';
import TOKEN from '../../token.js';

const getRepos = async (owner) => {
  try {
    const options = {
      url: `https://api.github.com/users/${owner}/repos`,
      method: 'get',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${process.env.TOKEN || TOKEN}`,
      },
    };
    const res = await axios(options);
    return res.data;
  } catch (e) {
    return e;
  }
};

export default getRepos;

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
    const response = await axios(options);
    if (response.data) {
      return response.data;
    }
    return {};
  } catch (error) {
    return error;
  }
};

export default getRepos;

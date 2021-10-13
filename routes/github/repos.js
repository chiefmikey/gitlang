import axios from 'axios';

const getRepos = async (owner) => {
  try {
    const options = {
      url: `https://api.github.com/users/${owner}/repos`,
      method: 'get',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${process.env.TOKEN}`,
      },
    };
    return await axios(options);
  } catch (e) {
    return e;
  }
};

export default getRepos;

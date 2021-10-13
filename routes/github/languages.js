import axios from 'axios';

const getLanguages = async (owner, repo) => {
  try {
    const options = {
      url: `https://api.github.com/repos/${owner}/${repo}/languages`,
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

export default getLanguages;

import axios from 'axios';

const getRepos = async () => {
  try {
    const options = {
      url: `https://api.github.com/users/${process.env.OWNER}`,
      headers: {
        'User-Agent': 'request',
        // Authorization: `token ${process.env.AUTH}`,
      },
    };
    return await axios(options);
  } catch (e) {
    return e;
  }
};

export default getRepos;

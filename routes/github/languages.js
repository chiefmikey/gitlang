import axios from 'axios';

const getLanguages = async () => {
  try {
    const options = {
      url: `https://api.github.com//repos/${process.env.OWNER}/${repo}/languages`,
      headers: {
        'User-Agent': 'request',
        Accept: 'application/vnd.github.v3+json',
        // Authorization: `token ${process.env.AUTH}`,
      },
    };
    return await axios(options);
  } catch (e) {
    return e;
  }
};

export default getLanguages;

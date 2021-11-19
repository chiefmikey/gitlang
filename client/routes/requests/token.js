import axios from 'axios';
import environment from '../../environment.js';

let token;
const auth = async () => {
  try {
    if (!token) {
      token = await axios.get(
        `http://${environment.tokenApi}/auth/github/repo`,
      );
    }
    return token.data;
  } catch {
    console.log('Error getting token from auth api', token);
    return token;
  }
};

export default auth;

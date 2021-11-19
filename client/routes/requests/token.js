import axios from 'axios';
import environment from '../../environment.js';

let token;
const auth = async () => {
  try {
    if (!token) {
      token = await axios.get(`${environment.tokenApi}/auth/github/repo`);
    }
    return token.data;
  } catch (error) {
    console.log('Error getting token from auth api', error);
    return token;
  }
};

export default auth;

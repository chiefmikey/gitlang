import axios from 'axios';

import environment from '../../environment.js';

let token;
const auth = async () => {
  try {
    if (!token) {
      token = await axios.get(`${environment.tokenApi}/auth/github/repo`);
    }
    if (token && token.data && token.data.length > 0) return token.data;
    return '';
  } catch (error) {
    console.log('Error getting token from auth api', error);
    return '';
  }
};

export default auth;

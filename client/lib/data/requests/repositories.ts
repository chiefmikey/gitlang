import axios, { type AxiosResponse } from 'axios';

import { ROUTES } from '../constants';

const repositories = async (username: string): Promise<string[]> => {
  try {
    const response: AxiosResponse<string[]> = await axios.get(ROUTES.REPOS, {
      params: { username },
    });
    return response.data.length > 0 ? response.data : [];
  } catch (error) {
    console.error('Error fetching repositories', error);
    throw error;
  }
};

export default repositories;

import axios, { type AxiosResponse } from 'axios';

import { ROUTES } from '../constants';

const repositories = async (
  username: string,
  includeForks = false,
): Promise<string[]> => {
  try {
    const params: Record<string, string> = { username };
    if (includeForks) {
      params.includeForks = 'true';
    }
    const response: AxiosResponse<string[]> = await axios.get(ROUTES.REPOS, {
      params,
    });
    return response.data.length > 0 ? response.data : [];
  } catch (error) {
    console.error('Error fetching repositories', error);
    throw error;
  }
};

export default repositories;

import axios, { type AxiosResponse } from 'axios';

import { ROUTES } from '../constants';

interface ContributorInfo {
  login: string;
  contributions: number;
  avatar_url: string;
}

const contributors = async (
  owner: string,
  repo: string,
): Promise<ContributorInfo[]> => {
  try {
    const response: AxiosResponse<ContributorInfo[]> = await axios.get(
      ROUTES.CONTRIBUTORS,
      { params: { owner, repo } },
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching contributors', error);
    return [];
  }
};

type LanguageData = Record<string, number>;

const contributorLanguages = async (
  owner: string,
  repo: string,
  author: string,
): Promise<LanguageData> => {
  try {
    const response: AxiosResponse<LanguageData> = await axios.get(
      ROUTES.CONTRIBUTOR_LANGS,
      { params: { owner, repo, author } },
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching contributor languages', error);
    return {};
  }
};

export { contributors, contributorLanguages };
export type { ContributorInfo };

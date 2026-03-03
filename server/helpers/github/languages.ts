import { Octokit } from '@octokit/rest';

const fetchLanguage = async (
  owner: string,
  repo: string,
  token: string,
): Promise<Record<string, number>> => {
  try {
    if (token === '') {
      console.error('No token');
      return {};
    }
    const octokit = new Octokit({ auth: token });
    const response = await octokit.rest.repos.listLanguages({ owner, repo });
    return response.data;
  } catch (error) {
    console.error('Error fetching language:', error);
    return {};
  }
};

const languages = async (
  owner: string,
  names: string[],
  token: string,
): Promise<Record<string, number>[]> => {
  return Promise.all(
    names.map(async (repo) => fetchLanguage(owner, repo, token)),
  );
};

export default languages;

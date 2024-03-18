import { Octokit } from '@octokit/rest';

let octokit: Octokit;

const fetchLanguage = async (owner: string, repo: string, token: string) => {
  try {
    if (!token) {
      console.error('No token');
      return [];
    }
    octokit = new Octokit({ auth: token });
    return await octokit.paginate(octokit.rest.repos.listLanguages, {
      owner,
      repo,
    });
  } catch (error) {
    console.error('Error fetching language:', error);
    return [];
  }
};

const languages = async (owner: string, names: string[], token: string) => {
  const langs = names.map((repo) => fetchLanguage(owner, repo, token));
  return Promise.all(langs) as Promise<Array<{ [key: string]: number }>>;
};

export default languages;

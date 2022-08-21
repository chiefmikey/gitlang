import { Octokit } from '@octokit/rest';

let octokit: Octokit;

const fetchLanguage = async (owner: string, repo: string, token?: string) => {
  try {
    if (!octokit) {
      if (!token) {
        console.error('No token');
        return [];
      }
      octokit = new Octokit({ auth: token });
    }
    return await octokit.paginate(octokit.rest.repos.listLanguages, {
      owner,
      repo,
    });
  } catch {
    return [];
  }
};

const languages = async (owner: string, names: string[], token?: string) => {
  const langs = [];
  for (const repo of names) {
    langs.push(await fetchLanguage(owner, repo, token));
  }
  return langs;
};

export default languages;

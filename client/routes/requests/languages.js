import { Octokit } from 'octokit';

const octokit = new Octokit();

const fetchLanguage = async (owner, repo) => {
  try {
    const response = await octokit.paginate(
      'GET /repos/{owner}/{repo}/languages',
      {
        owner,
        repo,
        type: 'public',
        per_page: 100,
      },
    );
    if (response) {
      return response;
    }
    return {};
  } catch (error) {
    return error;
  }
};

const getLanguages = async (owner, names) => {
  const languages = [];
  for await (const repo of names) {
    languages.push(await fetchLanguage(owner, repo));
  }
  return languages.flat();
};

export default getLanguages;

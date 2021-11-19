import { Octokit } from 'octokit';

let octokit;

const fetchLanguage = async (owner, repo, token) => {
  try {
    const allLangs = [];
    if (!octokit) {
      octokit = new Octokit({ auth: token });
    }
    const response = await octokit.paginate.iterator(
      'GET /repos/{owner}/{repo}/languages',
      {
        owner,
        repo,
        type: 'public',
        per_page: 100,
      },
    );
    for await (const { data } of response) {
      allLangs.push(data);
    }
    return allLangs;
  } catch (error) {
    console.log('Error getting languages', error);
    return [];
  }
};

const getLanguages = (owner, names, token) => {
  const languages = [];
  for (const repo of names) {
    languages.push(fetchLanguage(owner, repo, token));
  }
  return Promise.all(languages);
};

export default getLanguages;

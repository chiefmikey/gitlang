import { Octokit } from 'octokit';

let octokit;

const getRepos = async (owner, token) => {
  try {
    if (!octokit) {
      octokit = new Octokit({ auth: token });
    }
    const response = await octokit.paginate('GET /users/{owner}/repos', {
      owner,
      type: 'public',
      per_page: 100,
    });
    if (response) {
      return response;
    }
    return {};
  } catch (error) {
    console.log('Error getting repos', error);
    return {};
  }
};

export default getRepos;

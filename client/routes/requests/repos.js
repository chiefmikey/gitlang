import { Octokit } from 'octokit';

const octokit = new Octokit();

const getRepos = async (owner) => {
  try {
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
    return error;
  }
};

export default getRepos;

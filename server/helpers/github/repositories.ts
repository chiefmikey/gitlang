import { Octokit } from '@octokit/rest';

let octokit: Octokit;

const repositories = async (username: string, token: string) => {
  try {
    if (!token) {
      console.error('No token');
      return [];
    }
    octokit = new Octokit({ auth: token });
    return await octokit.paginate(
      octokit.rest.repos.listForUser,
      {
        username,
        type: 'owner',
      },
      (response) =>
        response.data.filter(({ fork }) => !fork).map(({ name }) => name),
    );
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return [];
  }
};

export default repositories;

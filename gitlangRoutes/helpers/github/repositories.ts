import { Octokit } from '@octokit/rest';

let octokit: Octokit;

const repositories = async (username: string, token: string) => {
  try {
    if (!octokit) {
      if (!token) {
        console.error('No token');
        return [];
      }
      octokit = new Octokit({ auth: token });
    }
    return await octokit.paginate(
      octokit.rest.repos.listForUser,
      {
        username,
        type: 'owner',
      },
      (response) =>
        response.data
          .filter((repo: { fork: boolean }) => repo.fork === false)
          .map((repo: { name: string }) => repo.name),
    );
  } catch {
    return [];
  }
};

export default repositories;

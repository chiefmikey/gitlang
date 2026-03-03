import { Octokit } from '@octokit/rest';

const languages = async (
  owner: string,
  names: string[],
  token: string,
): Promise<Record<string, number>[]> => {
  if (token === '') {
    console.error('No token');
    return names.map(() => ({}));
  }
  const octokit = new Octokit({ auth: token });
  return Promise.all(
    names.map(async (repo) => {
      try {
        const response = await octokit.rest.repos.listLanguages({
          owner,
          repo,
        });
        return response.data;
      } catch (error) {
        console.error(`Error fetching language for ${repo}:`, error);
        return {};
      }
    }),
  );
};

export default languages;

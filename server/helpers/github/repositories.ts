import { Octokit } from '@octokit/rest';

let octokit: Octokit;

const isOrganization = (input: string): boolean => {
  return (
    input.startsWith('@') ||
    input.startsWith('org:') ||
    input.startsWith('org/')
  );
};

const parseOrgName = (input: string): string => {
  if (input.startsWith('@')) {
    return input.slice(1);
  }
  if (input.startsWith('org:') || input.startsWith('org/')) {
    return input.slice(4);
  }
  return input;
};

const repositories = async (username: string, token: string) => {
  try {
    if (!token) {
      console.error('No token');
      return [];
    }
    octokit = new Octokit({ auth: token });

    const isOrg = isOrganization(username);
    const parsedName = isOrg ? parseOrgName(username) : username;

    if (isOrg) {
      return await octokit.paginate(
        octokit.rest.repos.listForOrg,
        {
          org: parsedName,
          type: 'public',
        },
        (response) =>
          response.data.filter(({ fork }) => !fork).map(({ name }) => name),
      );
    }
    return await octokit.paginate(
      octokit.rest.repos.listForUser,
      {
        username: parsedName,
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

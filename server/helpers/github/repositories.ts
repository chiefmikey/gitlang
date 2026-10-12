import { Octokit } from '@octokit/rest';

import {
  describeError,
  isUnavailableError,
  isValidLogin,
  MAX_REPO_PAGES,
  REPOS_PER_PAGE,
  toRateLimitError,
} from './githubSafety';

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

interface RepoPage {
  data: { fork: boolean; name: string }[];
  headers: { link?: string };
}

// Builds the per-page mapper for paginate(). Stops following pages after
// MAX_REPO_PAGES so one huge account cannot burn the shared rate limit.
const pageMapper = (includeForks: boolean) => {
  let pages = 0;
  return (response: RepoPage, done: () => void): string[] => {
    pages += 1;
    if (pages >= MAX_REPO_PAGES) {
      if (response.headers.link?.includes('rel="next"') === true) {
        console.warn(
          `Repository list truncated at ${String(MAX_REPO_PAGES * REPOS_PER_PAGE)} entries`,
        );
      }
      done();
    }
    return response.data
      .filter(({ fork }) => includeForks || !fork)
      .map(({ name }) => name);
  };
};

const listNames = async (
  octokit: Octokit,
  isOrg: boolean,
  name: string,
  includeForks: boolean,
): Promise<string[]> =>
  isOrg
    ? octokit.paginate(
        octokit.rest.repos.listForOrg,
        { org: name, per_page: REPOS_PER_PAGE, type: 'public' },
        pageMapper(includeForks),
      )
    : octokit.paginate(
        octokit.rest.repos.listForUser,
        { per_page: REPOS_PER_PAGE, type: 'owner', username: name },
        pageMapper(includeForks),
      );

/**
 * Lists public repository names for a user or (with @, org: or org/ prefix)
 * an organization. Resolves to [] when the account does not exist, is
 * inaccessible, or the name is not a valid GitHub login. Rejects with
 * GitHubRateLimitError when GitHub rate limits the request, and with the
 * original error for outages and credential failures, so callers can tell
 * those apart from "not found".
 */
const repositories = async (
  username: string,
  token: string,
  includeForks = false,
): Promise<string[]> => {
  if (token === '') {
    console.error('No token');
    return [];
  }

  const isOrg = isOrganization(username);
  const parsedName = isOrg ? parseOrgName(username) : username;
  if (!isValidLogin(parsedName)) {
    return [];
  }

  const octokit = new Octokit({ auth: token });
  try {
    return await listNames(octokit, isOrg, parsedName, includeForks);
  } catch (error) {
    const limited = toRateLimitError(error);
    if (limited !== undefined) {
      console.error(
        `Rate limited fetching repositories: ${describeError(error)}`,
      );
      throw limited;
    }
    if (isUnavailableError(error)) {
      return [];
    }
    console.error(`Error fetching repositories: ${describeError(error)}`);
    throw error;
  }
};

export { isOrganization, parseOrgName };
export default repositories;

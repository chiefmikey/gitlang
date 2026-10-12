import { Octokit } from '@octokit/rest';

import {
  describeError,
  isUnavailableError,
  isValidLogin,
  isValidRepoName,
  MAX_CONCURRENCY,
  MAX_REPOS,
  toRateLimitError,
} from './githubSafety';

type LanguageBytes = Record<string, number>;

interface RunState {
  failure: Error | undefined;
  next: number;
}

const fetchOne = async (
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<LanguageBytes> => {
  if (!isValidRepoName(repo)) {
    return {};
  }
  try {
    const response = await octokit.rest.repos.listLanguages({ owner, repo });
    return response.data;
  } catch (error) {
    const limited = toRateLimitError(error);
    if (limited === undefined && isUnavailableError(error)) {
      return {};
    }
    console.error(
      `Error fetching language for ${owner}/${repo}: ${describeError(error)}`,
    );
    throw (
      limited ?? (error instanceof Error ? error : new Error(String(error)))
    );
  }
};

/**
 * Fetches language byte counts for each repo, in input order. A repo that is
 * missing, blocked, or inaccessible (or has an invalid name) yields {}.
 * Rejects with GitHubRateLimitError when GitHub rate limits the request (no
 * further calls are issued once that happens), with the original error for
 * outages and credential failures, and with RangeError for more than
 * MAX_REPOS names; a failure is never reported as an empty language set.
 * At most MAX_CONCURRENCY calls are in flight at once.
 */
const languages = async (
  owner: string,
  names: string[],
  token: string,
): Promise<LanguageBytes[]> => {
  if (token === '') {
    console.error('No token');
    return names.map(() => ({}));
  }
  if (names.length > MAX_REPOS) {
    throw new RangeError(
      `Too many repositories: ${String(names.length)} (max ${String(MAX_REPOS)})`,
    );
  }
  if (!isValidLogin(owner)) {
    return names.map(() => ({}));
  }

  const octokit = new Octokit({ auth: token });
  const results: LanguageBytes[] = names.map(() => ({}));
  const state: RunState = { failure: undefined, next: 0 };

  // Each worker pulls the next unclaimed index until the list is exhausted or
  // any worker has failed, which bounds both concurrency and wasted calls.
  const worker = async (): Promise<void> => {
    while (state.failure === undefined && state.next < names.length) {
      const index = state.next;
      state.next += 1;
      try {
        // Sequential within a worker by design (bounded concurrency).
        results[index] = await fetchOne(octokit, owner, names[index]);
      } catch (error) {
        state.failure ??=
          error instanceof Error ? error : new Error(String(error));
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENCY, names.length) }, worker),
  );

  if (state.failure !== undefined) {
    throw state.failure;
  }
  return results;
};

export default languages;

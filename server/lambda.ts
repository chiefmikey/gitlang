import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import auth from './helpers/github/auth';
import {
  getContributorLanguages,
  listContributors,
} from './helpers/github/contributors';
import { GitHubRateLimitError } from './helpers/github/githubSafety';
import languages from './helpers/github/languages';
import fetchMerged from './helpers/github/merged';
import rateLimit from './helpers/github/rateLimit';
import repositories from './helpers/github/repositories';
import {
  isRateLimitError,
  isValidAuthor,
  isValidLogin,
  isValidOwnerInput,
  isValidRepoName,
  parseRepoList,
} from './helpers/validation';

type QueryParameters = Record<string, string | undefined>;

const getToken = async (): Promise<string> => {
  return auth();
};

const API_PREFIX = '/gitlang/github';
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

// One /contributor-langs call costs 1 commit-list request plus up to 50
// commit-detail requests; refuse to start when the remaining budget cannot
// cover a full run.
const CONTRIBUTOR_LANGS_MAX_REQUESTS = 51;

const json = (
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): APIGatewayProxyResultV2 => ({
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    // Never let a CDN cache a transient rate-limit or server failure.
    ...(statusCode === 429 || statusCode >= 500
      ? { 'Cache-Control': 'no-store' }
      : {}),
    ...extraHeaders,
  },
  statusCode,
});

// Strip the CloudFront route prefix from the START of the path only. (A plain
// String#replace would also match "/gitlang/github" in the middle of a path.)
const getRoutePath = (rawPath: unknown): string => {
  if (typeof rawPath !== 'string') {
    return '';
  }
  return rawPath.startsWith(API_PREFIX)
    ? rawPath.slice(API_PREFIX.length)
    : rawPath;
};

const getMethod = (event: APIGatewayProxyEventV2): string | undefined => {
  const context = event.requestContext as
    | { http?: { method?: string } }
    | undefined;
  return context?.http?.method?.toUpperCase();
};

const handleRepos = async (
  params: QueryParameters,
  token: string,
): Promise<APIGatewayProxyResultV2> => {
  const { includeForks, username } = params;
  if (username === undefined || username === '') {
    return json(400, { error: 'username required' });
  }
  if (!isValidOwnerInput(username)) {
    return json(400, { error: 'invalid username' });
  }
  const repos = await repositories(username, token, includeForks === 'true');
  return repos.length > 0 ? json(200, repos) : json(404, []);
};

const handleLangs = async (
  params: QueryParameters,
  token: string,
): Promise<APIGatewayProxyResultV2> => {
  const { owner, repos } = params;
  if (
    owner === undefined ||
    owner === '' ||
    repos === undefined ||
    repos === ''
  ) {
    return json(400, { error: 'owner and repos required' });
  }
  if (!isValidLogin(owner)) {
    return json(400, { error: 'invalid owner' });
  }
  const parsedRepos = parseRepoList(repos);
  if ('error' in parsedRepos) {
    return json(400, { error: parsedRepos.error });
  }
  const repoList = parsedRepos.repos;
  const rateLimitInfo = await rateLimit(token);
  if (
    rateLimitInfo !== undefined &&
    rateLimitInfo.remaining < repoList.length
  ) {
    return json(429, {
      error: 'Rate limit insufficient',
      needed: repoList.length,
      remaining: rateLimitInfo.remaining,
      reset: rateLimitInfo.reset,
    });
  }
  const langs = await languages(owner, repoList, token);
  return langs.length > 0 ? json(200, langs) : json(404, []);
};

const handleMerged = async (
  params: QueryParameters,
  token: string,
): Promise<APIGatewayProxyResultV2> => {
  const { username } = params;
  if (username === undefined || username === '') {
    return json(400, { error: 'username required' });
  }
  if (!isValidOwnerInput(username)) {
    return json(400, { error: 'invalid username' });
  }
  const result = await fetchMerged(username, token);
  if (result.repos.length === 0) {
    return json(404, { langs: [], repos: [] });
  }
  return json(200, result);
};

const handleRateLimit = async (
  token: string,
): Promise<APIGatewayProxyResultV2> => {
  const info = await rateLimit(token);
  return info === undefined
    ? json(500, { error: 'Unable to fetch rate limit' })
    : json(200, info);
};

const handleContributors = async (
  params: QueryParameters,
  token: string,
): Promise<APIGatewayProxyResultV2> => {
  const { owner, repo } = params;
  if (
    owner === undefined ||
    owner === '' ||
    repo === undefined ||
    repo === ''
  ) {
    return json(400, { error: 'owner and repo required' });
  }
  if (!isValidLogin(owner) || !isValidRepoName(repo)) {
    return json(400, { error: 'invalid owner or repo' });
  }
  const contribs = await listContributors(owner, repo, token);
  return contribs.length > 0 ? json(200, contribs) : json(404, []);
};

const handleContributorLangs = async (
  params: QueryParameters,
  token: string,
): Promise<APIGatewayProxyResultV2> => {
  const { author, owner, repo } = params;
  if (
    owner === undefined ||
    owner === '' ||
    repo === undefined ||
    repo === '' ||
    author === undefined ||
    author === ''
  ) {
    return json(400, { error: 'owner, repo, and author required' });
  }
  if (
    !isValidLogin(owner) ||
    !isValidRepoName(repo) ||
    !isValidAuthor(author)
  ) {
    return json(400, { error: 'invalid owner, repo, or author' });
  }
  const rateLimitInfo = await rateLimit(token);
  if (
    rateLimitInfo !== undefined &&
    rateLimitInfo.remaining < CONTRIBUTOR_LANGS_MAX_REQUESTS
  ) {
    return json(429, {
      error: 'Rate limit insufficient',
      needed: CONTRIBUTOR_LANGS_MAX_REQUESTS,
      remaining: rateLimitInfo.remaining,
      reset: rateLimitInfo.reset,
    });
  }
  const langs = await getContributorLanguages(owner, repo, author, token);
  return json(200, langs);
};

// Structured error logging for CloudWatch: every 500 carries the request
// path and an operation tag so failures are diagnosable from the log stream.
const logHandlerError = (
  operation: string,
  path: string,
  extra: Record<string, string>,
): void => {
  console.error(
    JSON.stringify({
      ...extra,
      event: 'handler_error',
      operation,
      path: path.slice(0, 200),
    }),
  );
};

const routeRequest = async (
  path: string,
  params: QueryParameters,
  token: string,
): Promise<APIGatewayProxyResultV2> => {
  switch (path) {
    case '/repos': {
      return handleRepos(params, token);
    }
    case '/langs': {
      return handleLangs(params, token);
    }
    case '/merged': {
      return handleMerged(params, token);
    }
    case '/rate-limit': {
      return handleRateLimit(token);
    }
    case '/contributors': {
      return handleContributors(params, token);
    }
    case '/contributor-langs': {
      return handleContributorLangs(params, token);
    }
    default: {
      return json(404, { error: 'Not found' });
    }
  }
};

// Upstream rate limiting is reported as 429 (the client shows a "try again"
// message for it); everything else is an opaque 500. The upstream message is
// logged for diagnosis but never returned to the caller.
const errorResponse = (
  error: unknown,
  path: string,
): APIGatewayProxyResultV2 => {
  const rateLimited = isRateLimitError(error);
  logHandlerError(
    rateLimited ? 'upstream_rate_limit' : 'route_dispatch',
    path,
    {
      error: (error instanceof Error ? error.message : String(error)).slice(
        0,
        300,
      ),
    },
  );
  if (!rateLimited) {
    return json(500, { error: 'Internal server error' });
  }
  const retryAfter =
    error instanceof GitHubRateLimitError ? error.retryAfter : undefined;
  return json(
    429,
    {
      error: 'GitHub API rate limit reached, try again later',
      ...(error instanceof GitHubRateLimitError && error.reset !== undefined
        ? { reset: error.reset }
        : {}),
    },
    retryAfter === undefined ? {} : { 'Retry-After': String(retryAfter) },
  );
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const path = getRoutePath(event.rawPath);
  const params: QueryParameters = event.queryStringParameters ?? {};

  const method = getMethod(event);
  if (method !== undefined && !ALLOWED_METHODS.has(method)) {
    return json(405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
  }

  try {
    const token = await getToken();
    if (token === '') {
      logHandlerError('get_token', path, {
        detail: 'auth() returned empty token',
      });
      return json(500, { error: 'No GitHub token configured' });
    }
    return await routeRequest(path, params, token);
  } catch (error) {
    return errorResponse(error, path);
  }
};

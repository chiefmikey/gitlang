import {
  GitHubRateLimitError,
  isValidLogin as isLogin,
  isValidRepoName as isRepoName,
} from './github/githubSafety';

// Shared request validation and upstream error classification for the API
// routes (AWS Lambda handler and the local-dev Koa router). Every pattern is a
// single anchored character class with a bounded quantifier, so matching is
// linear-time (no nested or overlapping quantifiers, no ReDoS surface).

// Commit author filter: a login (optionally a "[bot]" account such as
// dependabot[bot]) or an email-ish string. It is only ever sent as a
// percent-encoded query parameter, so this is a sanity/size bound.
const AUTHOR_PATTERN = /^[\w%+.@-]{1,254}(?:\[bot\])?$/u;

// Upper bound for the `repos` array of /langs. Each element costs one GitHub
// API request, so an unbounded array is a request-amplification vector.
const MAX_REPOS_PER_REQUEST = 100;

const parseOwnerName = (input: string): { isOrg: boolean; name: string } => {
  if (input.startsWith('@')) {
    return { isOrg: false, name: input.slice(1) };
  }
  if (input.startsWith('org:') || input.startsWith('org/')) {
    return { isOrg: true, name: input.slice(4) };
  }
  return { isOrg: false, name: input };
};

const isValidLogin = (value: unknown): value is string =>
  typeof value === 'string' && isLogin(value);

// "username" style input: a login, optionally prefixed with @, org: or org/.
const isValidOwnerInput = (value: unknown): value is string =>
  typeof value === 'string' && isValidLogin(parseOwnerName(value).name);

// A repo name is also used as a URL path segment; "." and ".." would be
// resolved as dot-segments by the HTTP client and escape the intended route.
const isValidRepoName = (value: unknown): value is string =>
  typeof value === 'string' && isRepoName(value);

const isValidAuthor = (value: unknown): value is string =>
  typeof value === 'string' && AUTHOR_PATTERN.test(value);

type RepoListResult = { error: string } | { repos: string[] };

const parseRepoList = (raw: string): RepoListResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'repos must be a JSON array of strings or valid JSON' };
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.every((item: unknown) => typeof item === 'string')
  ) {
    return { error: 'repos must be a JSON array of strings or valid JSON' };
  }
  if (parsed.length > MAX_REPOS_PER_REQUEST) {
    return {
      error: `repos may contain at most ${MAX_REPOS_PER_REQUEST} entries`,
    };
  }
  if (!parsed.every((name: string) => isValidRepoName(name))) {
    return { error: 'repos contains an invalid repository name' };
  }
  return { repos: parsed };
};

interface UpstreamErrorShape {
  errors?: unknown;
  message?: unknown;
  response?: { headers?: Record<string, unknown> };
  status?: unknown;
}

const asShape = (error: unknown): UpstreamErrorShape =>
  typeof error === 'object' && error !== null
    ? (error as UpstreamErrorShape)
    : {};

const graphqlErrorTypes = (error: unknown): string[] => {
  const { errors } = asShape(error);
  if (!Array.isArray(errors)) {
    return [];
  }
  const types: string[] = [];
  for (const item of errors as unknown[]) {
    if (typeof item === 'object' && item !== null && 'type' in item) {
      const { type } = item;
      if (typeof type === 'string') {
        types.push(type);
      }
    }
  }
  return types;
};

// True when GitHub refused the call because the app is rate limited: primary
// limit (403/429 with x-ratelimit-remaining: 0), secondary/abuse limit
// (429 or 403 with retry-after / "rate limit" message) or a GraphQL
// RATE_LIMITED error.
const isRateLimitError = (error: unknown): boolean => {
  if (error instanceof GitHubRateLimitError) {
    return true;
  }
  if (graphqlErrorTypes(error).includes('RATE_LIMITED')) {
    return true;
  }
  const { message, response, status } = asShape(error);
  if (status === 429) {
    return true;
  }
  if (status !== 403) {
    return false;
  }
  const headers = response?.headers ?? {};
  return (
    String(headers['x-ratelimit-remaining']) === '0' ||
    headers['retry-after'] !== undefined ||
    (typeof message === 'string' && /rate limit/iu.test(message))
  );
};

// True for a GraphQL "Could not resolve to a User/Organization" error (or a
// REST 404): the account simply does not exist.
const isNotFoundError = (error: unknown): boolean =>
  graphqlErrorTypes(error).includes('NOT_FOUND') ||
  asShape(error).status === 404;

export {
  isNotFoundError,
  isRateLimitError,
  isValidAuthor,
  isValidLogin,
  isValidOwnerInput,
  isValidRepoName,
  MAX_REPOS_PER_REQUEST,
  parseOwnerName,
  parseRepoList,
};

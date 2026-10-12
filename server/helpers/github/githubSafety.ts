/**
 * Shared guards for the GitHub helpers: input validation for values that end
 * up as URL path segments, classification of Octokit errors, and bounds that
 * protect the shared installation token's rate limit.
 */

/** Page size used when listing repositories. */
const REPOS_PER_PAGE = 100;

/** Hard cap on repository-list pages followed per request. */
const MAX_REPO_PAGES = 20;

/** Largest repo list one request may fan out into (one API call per repo). */
const MAX_REPOS = MAX_REPO_PAGES * REPOS_PER_PAGE;

/** Max simultaneous in-flight GitHub calls per request. */
const MAX_CONCURRENCY = 10;

// GitHub logins: alphanumerics and hyphens (underscore for managed users),
// at most 39 characters.
const LOGIN_PATTERN = /^[\dA-Za-z][\w-]{0,38}$/u;

// GitHub repository names: alphanumerics, '.', '-', '_' (max 100 characters).
const REPO_NAME_PATTERN = /^[\w.-]{1,100}$/u;

/**
 * Octokit percent-encodes path parameters but leaves '.' alone, so '..' would
 * otherwise be normalized away by fetch and redirect the call to a different
 * GitHub endpoint. Anything not shaped like a real login/repo name is refused
 * before it reaches a URL.
 */
const isValidLogin = (value: string): boolean => LOGIN_PATTERN.test(value);

const isValidRepoName = (value: string): boolean =>
  REPO_NAME_PATTERN.test(value) && !/^\.+$/u.test(value);

class GitHubRateLimitError extends Error {
  readonly status: number;
  /** Epoch seconds at which the primary limit resets, when GitHub said so. */
  readonly reset?: number;
  /** Seconds GitHub asked us to wait (secondary limits), when it said so. */
  readonly retryAfter?: number;

  constructor(
    message: string,
    status: number,
    reset?: number,
    retryAfter?: number,
  ) {
    super(message);
    this.name = 'GitHubRateLimitError';
    this.status = status;
    this.reset = reset;
    this.retryAfter = retryAfter;
  }
}

type HeaderValue = number | string | undefined;

interface OctokitLikeError {
  message?: unknown;
  response?: { headers?: Record<string, HeaderValue> };
  status?: unknown;
}

const asRecord = (error: unknown): OctokitLikeError =>
  typeof error === 'object' && error !== null
    ? (error as OctokitLikeError)
    : {};

const statusOf = (error: unknown): number | undefined => {
  const { status } = asRecord(error);
  return typeof status === 'number' ? status : undefined;
};

const messageOf = (error: unknown): string => {
  const { message } = asRecord(error);
  if (typeof message === 'string') {
    return message;
  }
  return error instanceof Error ? error.message : String(error);
};

const toNumber = (value: HeaderValue): number | undefined => {
  if (value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Returns a GitHubRateLimitError when `error` is a primary (403 with no quota
 * left) or secondary (429, or 403 with Retry-After / rate-limit wording)
 * rate-limit response, otherwise undefined.
 */
const toRateLimitError = (error: unknown): GitHubRateLimitError | undefined => {
  if (error instanceof GitHubRateLimitError) {
    return error;
  }
  const status = statusOf(error);
  if (status !== 429 && status !== 403) {
    return undefined;
  }
  const headers = asRecord(error).response?.headers ?? {};
  const message = messageOf(error);
  const reset = toNumber(headers['x-ratelimit-reset']);
  const retryAfter = toNumber(headers['retry-after']);
  const exhausted =
    status === 429 ||
    toNumber(headers['x-ratelimit-remaining']) === 0 ||
    retryAfter !== undefined ||
    /rate limit|abuse/iu.test(message);
  return exhausted
    ? new GitHubRateLimitError(message, status, reset, retryAfter)
    : undefined;
};

/**
 * True when the target is simply not available to us (missing, blocked,
 * private, empty, or access-restricted) as opposed to GitHub or our
 * credentials failing. Callers that fold these into "no data" must check
 * rate limits first.
 */
const isUnavailableError = (error: unknown): boolean => {
  const status = statusOf(error);
  return (
    status === 403 ||
    status === 404 ||
    status === 409 ||
    status === 410 ||
    status === 451
  );
};

/**
 * Single-line, secret-free description of an error for logs. Full Octokit
 * error objects dump request and response headers and bodies (and, for
 * foreign error types, could carry credentials), so never log them raw.
 */
const describeError = (error: unknown): string => {
  const status = statusOf(error);
  const message = messageOf(error).replaceAll(/\s+/gu, ' ').slice(0, 200);
  return status === undefined ? message : `${String(status)} ${message}`;
};

export {
  describeError,
  GitHubRateLimitError,
  isUnavailableError,
  isValidLogin,
  isValidRepoName,
  MAX_CONCURRENCY,
  MAX_REPO_PAGES,
  MAX_REPOS,
  REPOS_PER_PAGE,
  toRateLimitError,
};

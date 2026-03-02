// source
export const INPUT = {
  PLACEHOLDER: '[ user/repo,repo ] or [ @org ]',
};

export const ERROR = {
  NOT_FOUND: 'Not Found',
  RATE_LIMIT: 'API rate limit reached. Try again in a few minutes.',
};

// custom
const { hostname } = window.location;
const isLocal = hostname === 'localhost';

const API_BASE = isLocal
  ? 'http://localhost:3000/gitlang/github'
  : 'https://api.5105015032.com/gitlang/github';

export const ROUTES = {
  REPOS: `${API_BASE}/repos`,
  LANGS: `${API_BASE}/langs`,
  RATE_LIMIT: `${API_BASE}/rate-limit`,
};

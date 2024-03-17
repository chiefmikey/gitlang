// source
export const INPUT = {
  PLACEHOLDER: '[ username / repo ]',
};

export const ERROR = {
  NOT_FOUND: 'Not Found',
};

// custom
const { hostname } = window.location;
const isLocal = hostname === 'localhost';

export const ROUTES = {
  REPOS: isLocal ? 'http://localhost:3000/gitlang/github/repos' : 'https://api.5105015032.com/gitlang/github/repos',
  LANGS: isLocal ? 'http://localhost:3000/gitlang/github/langs' : 'https://api.5105015032.com/gitlang/github/langs',
};

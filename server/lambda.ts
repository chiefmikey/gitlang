import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import auth from './helpers/github/auth';
import {
  getContributorLanguages,
  listContributors,
} from './helpers/github/contributors';
import languages from './helpers/github/languages';
import fetchMerged from './helpers/github/merged';
import rateLimit from './helpers/github/rateLimit';
import repositories from './helpers/github/repositories';

type QueryParameters = Record<string, string | undefined>;

const getToken = async (): Promise<string> => {
  return auth();
};

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
  statusCode,
});

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item: unknown) => typeof item === 'string');

const parseRepoList = (repos: string): string[] | undefined => {
  try {
    const parsed: unknown = JSON.parse(repos);
    return isStringArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const handleRepos = async (
  params: QueryParameters,
  token: string,
): Promise<APIGatewayProxyResultV2> => {
  const { includeForks, username } = params;
  if (username === undefined || username === '') {
    return json(400, { error: 'username required' });
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
  const repoList = parseRepoList(repos);
  if (repoList === undefined) {
    return json(400, {
      error: 'repos must be a JSON array of strings or valid JSON',
    });
  }
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
  const { includeForks, username } = params;
  if (username === undefined || username === '') {
    return json(400, { error: 'username required' });
  }
  const result = await fetchMerged(
    username,
    token,
    includeForks === 'true',
  );
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
  const langs = await getContributorLanguages(owner, repo, author, token);
  return json(200, langs);
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const path = event.rawPath.replace('/gitlang/github', '');
  const params: QueryParameters = event.queryStringParameters ?? {};

  try {
    const token = await getToken();
    if (token === '') {
      return json(500, { error: 'No GitHub token configured' });
    }

    switch (path) {
      case '/repos': {
        return await handleRepos(params, token);
      }
      case '/langs': {
        return await handleLangs(params, token);
      }
      case '/merged': {
        return await handleMerged(params, token);
      }
      case '/rate-limit': {
        return await handleRateLimit(token);
      }
      case '/contributors': {
        return await handleContributors(params, token);
      }
      case '/contributor-langs': {
        return await handleContributorLangs(params, token);
      }
      default: {
        return json(404, { error: 'Not found' });
      }
    }
  } catch (error) {
    console.error('Lambda handler error:', error);
    return json(500, { error: 'Internal server error' });
  }
};

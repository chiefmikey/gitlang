import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import {
  listContributors,
  getContributorLanguages,
} from './helpers/github/contributors';
import languages from './helpers/github/languages';
import rateLimit from './helpers/github/rateLimit';
import repositories from './helpers/github/repositories';
import auth from './helpers/github/auth';

const getToken = async (): Promise<string> => {
  return auth();
};

const json = (
  statusCode: number,
  body: unknown,
): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const path = event.rawPath.replace('/gitlang/github', '');
  const params = event.queryStringParameters || {};

  try {
    const token = await getToken();
    if (!token) {
      return json(500, { error: 'No GitHub token configured' });
    }

    switch (path) {
      case '/repos': {
        const { username, includeForks } = params;
        if (!username) {
          return json(400, { error: 'username required' });
        }
        const repos = await repositories(
          username,
          token,
          includeForks === 'true',
        );
        return repos.length > 0 ? json(200, repos) : json(404, []);
      }

      case '/langs': {
        const { owner, repos } = params;
        if (!owner || !repos) {
          return json(400, { error: 'owner and repos required' });
        }
        let repoList: string[];
        try {
          const parsed = JSON.parse(repos);
          if (
            !Array.isArray(parsed) ||
            !parsed.every((r: unknown) => typeof r === 'string')
          ) {
            return json(400, { error: 'repos must be a JSON array of strings' });
          }
          repoList = parsed;
        } catch {
          return json(400, { error: 'repos must be valid JSON' });
        }
        const rateLimitInfo = await rateLimit(token);
        if (rateLimitInfo && rateLimitInfo.remaining < repoList.length) {
          return json(429, {
            error: 'Rate limit insufficient',
            remaining: rateLimitInfo.remaining,
            needed: repoList.length,
            reset: rateLimitInfo.reset,
          });
        }
        const langs = await languages(owner, repoList, token);
        return langs.length > 0 ? json(200, langs) : json(404, []);
      }

      case '/rate-limit': {
        const info = await rateLimit(token);
        return info
          ? json(200, info)
          : json(500, { error: 'Unable to fetch rate limit' });
      }

      case '/contributors': {
        const { owner, repo } = params;
        if (!owner || !repo) {
          return json(400, { error: 'owner and repo required' });
        }
        const contribs = await listContributors(owner, repo, token);
        return contribs.length > 0 ? json(200, contribs) : json(404, []);
      }

      case '/contributor-langs': {
        const { owner, repo, author } = params;
        if (!owner || !repo || !author) {
          return json(400, { error: 'owner, repo, and author required' });
        }
        const langs = await getContributorLanguages(
          owner,
          repo,
          author,
          token,
        );
        return json(200, langs);
      }

      default:
        return json(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Lambda handler error:', error);
    return json(500, { error: 'Internal server error' });
  }
};

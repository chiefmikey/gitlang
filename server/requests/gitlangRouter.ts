import Router from '@koa/router';

import {
  getContributorLanguages,
  listContributors,
} from '../helpers/github/contributors';
import languages from '../helpers/github/languages';
import rateLimit from '../helpers/github/rateLimit';
import repositories from '../helpers/github/repositories';
import { getToken } from '../helpers/github/tokenManager';

const router = new Router({ prefix: '/github' });

interface KoaContext {
  response: { status: number; body: string };
}

interface KoaContextWithQuery<TQuery> extends KoaContext {
  request: { query: TQuery };
}

const setResponse = (
  context: KoaContext,
  data: Record<string, number>[] | string[],
): void => {
  if (data.length > 0) {
    context.response.status = 200;
    context.response.body = JSON.stringify(data);
  } else {
    context.response.status = 404;
    context.response.body = JSON.stringify([]);
  }
};

const parseRepoList = (repos: string): string[] | undefined => {
  try {
    const parsed: unknown = JSON.parse(repos);
    if (
      Array.isArray(parsed) &&
      parsed.every((r: unknown) => typeof r === 'string')
    ) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

router.get('/rate-limit', async (context: KoaContext) => {
  try {
    const token = await getToken();
    const info = await rateLimit(token);
    if (info === undefined) {
      context.response.status = 500;
      context.response.body = JSON.stringify({
        error: 'Unable to fetch rate limit',
      });
    } else {
      context.response.status = 200;
      context.response.body = JSON.stringify(info);
    }
  } catch (error) {
    console.error('Error in /rate-limit route:', error);
    context.response.status = 500;
    context.response.body = JSON.stringify({ error: 'Internal server error' });
  }
});

router.get(
  '/langs',
  async (context: KoaContextWithQuery<{ owner: string; repos: string }>) => {
    try {
      const token = await getToken();
      const { owner, repos } = context.request.query;
      const repoList = parseRepoList(repos);
      if (repoList === undefined) {
        context.response.status = 400;
        context.response.body = JSON.stringify({
          error: 'repos must be a JSON array of strings',
        });
        return;
      }

      const rateLimitInfo = await rateLimit(token);
      if (
        rateLimitInfo !== undefined &&
        rateLimitInfo.remaining < repoList.length
      ) {
        context.response.status = 429;
        context.response.body = JSON.stringify({
          error: 'Rate limit insufficient',
          needed: repoList.length,
          remaining: rateLimitInfo.remaining,
          reset: rateLimitInfo.reset,
        });
        return;
      }

      const response = await languages(owner, repoList, token);
      setResponse(context, response);
    } catch (error) {
      console.error('Error in /langs route:', error);
      setResponse(context, []);
    }
  },
);

router.get(
  '/repos',
  async (
    context: KoaContextWithQuery<{ username: string; includeForks?: string }>,
  ) => {
    try {
      const token = await getToken();
      const { includeForks, username } = context.request.query;
      const forks = includeForks === 'true';
      const response = await repositories(username, token, forks);
      setResponse(context, response);
    } catch (error) {
      console.error('Error in /repos route:', error);
      setResponse(context, []);
    }
  },
);

router.get(
  '/contributors',
  async (context: KoaContextWithQuery<{ owner: string; repo: string }>) => {
    try {
      const token = await getToken();
      const { owner, repo } = context.request.query;
      const contributors = await listContributors(owner, repo, token);
      if (contributors.length > 0) {
        context.response.status = 200;
        context.response.body = JSON.stringify(contributors);
      } else {
        context.response.status = 404;
        context.response.body = JSON.stringify([]);
      }
    } catch (error) {
      console.error('Error in /contributors route:', error);
      context.response.status = 500;
      context.response.body = JSON.stringify({
        error: 'Internal server error',
      });
    }
  },
);

router.get(
  '/merged',
  async (
    context: KoaContextWithQuery<{ username: string; includeForks?: string }>,
  ) => {
    try {
      const token = await getToken();
      const { includeForks, username } = context.request.query;
      const forks = includeForks === 'true';
      const repos = await repositories(username, token, forks);
      if (repos.length === 0) {
        context.response.status = 404;
        context.response.body = JSON.stringify({ repos: [], langs: [] });
        return;
      }
      const parsedName = username.startsWith('@')
        ? username.slice(1)
        : username.startsWith('org:') || username.startsWith('org/')
          ? username.slice(4)
          : username;
      const langs = await languages(parsedName, repos, token);
      context.response.status = 200;
      context.response.body = JSON.stringify({ repos, langs });
    } catch (error) {
      console.error('Error in /merged route:', error);
      context.response.status = 500;
      context.response.body = JSON.stringify({
        error: 'Internal server error',
      });
    }
  },
);

router.get(
  '/contributor-langs',
  async (
    context: KoaContextWithQuery<{
      author: string;
      owner: string;
      repo: string;
    }>,
  ) => {
    try {
      const token = await getToken();
      const { author, owner, repo } = context.request.query;
      const langs = await getContributorLanguages(owner, repo, author, token);
      context.response.status = 200;
      context.response.body = JSON.stringify(langs);
    } catch (error) {
      console.error('Error in /contributor-langs route:', error);
      context.response.status = 500;
      context.response.body = JSON.stringify({
        error: 'Internal server error',
      });
    }
  },
);

export default router;

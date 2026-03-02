import Router from '@koa/router';

import { listContributors, getContributorLanguages } from '../helpers/github/contributors';
import languages from '../helpers/github/languages';
import rateLimit from '../helpers/github/rateLimit';
import repositories from '../helpers/github/repositories';
import { getToken, updateTokenRateLimit } from '../helpers/github/tokenManager';

const router = new Router({ prefix: '/github' });

const setResponse = (
  context: { response: { status: number; body: string } },
  data: Record<string, number>[] | string[],
) => {
  if (data.length > 0) {
    context.response.status = 200;
    context.response.body = JSON.stringify(data);
  } else {
    context.response.status = 404;
    context.response.body = JSON.stringify([]);
  }
};

router.get(
  '/rate-limit',
  async (context: {
    response: { status: number; body: string };
  }) => {
    try {
      const token = await getToken();
      const info = await rateLimit(token);
      if (info) {
        updateTokenRateLimit(token, info.remaining, info.reset);
        context.response.status = 200;
        context.response.body = JSON.stringify(info);
      } else {
        context.response.status = 500;
        context.response.body = JSON.stringify({ error: 'Unable to fetch rate limit' });
      }
    } catch (error) {
      console.error('Error in /rate-limit route:', error);
      context.response.status = 500;
      context.response.body = JSON.stringify({ error: 'Internal server error' });
    }
  },
);

router.get(
  '/langs',
  async (context: {
    request: { query: { owner: string; repos: string } };
    response: { status: number; body: string };
  }) => {
    try {
      const token = await getToken();
      const { owner, repos } = context.request.query;
      const repoList = JSON.parse(repos) as string[];

      const rateLimitInfo = await rateLimit(token);
      if (rateLimitInfo) {
        updateTokenRateLimit(token, rateLimitInfo.remaining, rateLimitInfo.reset);
        if (rateLimitInfo.remaining < repoList.length) {
          context.response.status = 429;
          context.response.body = JSON.stringify({
            error: 'Rate limit insufficient',
            remaining: rateLimitInfo.remaining,
            needed: repoList.length,
            reset: rateLimitInfo.reset,
          });
          return;
        }
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
  async (context: {
    request: { query: { username: string; includeForks?: string } };
    response: { status: number; body: string };
  }) => {
    try {
      const token = await getToken();
      const { username, includeForks } = context.request.query;
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
  async (context: {
    request: { query: { owner: string; repo: string } };
    response: { status: number; body: string };
  }) => {
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
      context.response.body = JSON.stringify({ error: 'Internal server error' });
    }
  },
);

router.get(
  '/contributor-langs',
  async (context: {
    request: { query: { owner: string; repo: string; author: string } };
    response: { status: number; body: string };
  }) => {
    try {
      const token = await getToken();
      const { owner, repo, author } = context.request.query;
      const langs = await getContributorLanguages(owner, repo, author, token);
      context.response.status = 200;
      context.response.body = JSON.stringify(langs);
    } catch (error) {
      console.error('Error in /contributor-langs route:', error);
      context.response.status = 500;
      context.response.body = JSON.stringify({ error: 'Internal server error' });
    }
  },
);

export default router;

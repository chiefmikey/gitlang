import Router from '@koa/router';

import {
  getContributorLanguages,
  listContributors,
} from '../helpers/github/contributors';
import languages from '../helpers/github/languages';
import fetchMerged from '../helpers/github/merged';
import rateLimit from '../helpers/github/rateLimit';
import repositories from '../helpers/github/repositories';
import { getToken } from '../helpers/github/tokenManager';
import {
  isRateLimitError,
  isValidAuthor,
  isValidLogin,
  isValidOwnerInput,
  isValidRepoName,
  parseRepoList,
} from '../helpers/validation';

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

// Mirrors the Lambda handler: one /contributor-langs run costs 1 commit-list
// request plus up to 50 commit-detail requests.
const CONTRIBUTOR_LANGS_MAX_REQUESTS = 51;

const setBadRequest = (context: KoaContext, error: string): void => {
  context.response.status = 400;
  context.response.body = JSON.stringify({ error });
};

const setRateLimited = (context: KoaContext): void => {
  context.response.status = 429;
  context.response.body = JSON.stringify({
    error: 'GitHub API rate limit reached, try again later',
  });
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
      const { owner, repos } = context.request.query;
      if (!isValidLogin(owner)) {
        setBadRequest(context, 'invalid owner');
        return;
      }
      if (typeof repos !== 'string') {
        setBadRequest(context, 'repos required');
        return;
      }
      const parsedRepos = parseRepoList(repos);
      if ('error' in parsedRepos) {
        setBadRequest(context, parsedRepos.error);
        return;
      }
      const repoList = parsedRepos.repos;
      const token = await getToken();

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
      if (isRateLimitError(error)) {
        setRateLimited(context);
        return;
      }
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
      const { includeForks, username } = context.request.query;
      if (!isValidOwnerInput(username)) {
        setBadRequest(context, 'invalid username');
        return;
      }
      const token = await getToken();
      const response = await repositories(
        username,
        token,
        includeForks === 'true',
      );
      setResponse(context, response);
    } catch (error) {
      console.error('Error in /repos route:', error);
      if (isRateLimitError(error)) {
        setRateLimited(context);
        return;
      }
      setResponse(context, []);
    }
  },
);

router.get(
  '/contributors',
  async (context: KoaContextWithQuery<{ owner: string; repo: string }>) => {
    try {
      const { owner, repo } = context.request.query;
      if (!isValidLogin(owner) || !isValidRepoName(repo)) {
        setBadRequest(context, 'invalid owner or repo');
        return;
      }
      const token = await getToken();
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
      if (isRateLimitError(error)) {
        setRateLimited(context);
        return;
      }
      context.response.status = 500;
      context.response.body = JSON.stringify({
        error: 'Internal server error',
      });
    }
  },
);

router.get(
  '/merged',
  async (context: KoaContextWithQuery<{ username: string }>) => {
    try {
      const { username } = context.request.query;
      if (!isValidOwnerInput(username)) {
        setBadRequest(context, 'invalid username');
        return;
      }
      const token = await getToken();
      const result = await fetchMerged(username, token);
      if (result.repos.length === 0) {
        context.response.status = 404;
        context.response.body = JSON.stringify({ langs: [], repos: [] });
        return;
      }
      context.response.status = 200;
      context.response.body = JSON.stringify(result);
    } catch (error) {
      console.error('Error in /merged route:', error);
      if (isRateLimitError(error)) {
        setRateLimited(context);
        return;
      }
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
      const { author, owner, repo } = context.request.query;
      if (
        !isValidLogin(owner) ||
        !isValidRepoName(repo) ||
        !isValidAuthor(author)
      ) {
        setBadRequest(context, 'invalid owner, repo, or author');
        return;
      }
      const token = await getToken();
      const rateLimitInfo = await rateLimit(token);
      if (
        rateLimitInfo !== undefined &&
        rateLimitInfo.remaining < CONTRIBUTOR_LANGS_MAX_REQUESTS
      ) {
        context.response.status = 429;
        context.response.body = JSON.stringify({
          error: 'Rate limit insufficient',
          needed: CONTRIBUTOR_LANGS_MAX_REQUESTS,
          remaining: rateLimitInfo.remaining,
          reset: rateLimitInfo.reset,
        });
        return;
      }
      const langs = await getContributorLanguages(owner, repo, author, token);
      context.response.status = 200;
      context.response.body = JSON.stringify(langs);
    } catch (error) {
      console.error('Error in /contributor-langs route:', error);
      if (isRateLimitError(error)) {
        setRateLimited(context);
        return;
      }
      context.response.status = 500;
      context.response.body = JSON.stringify({
        error: 'Internal server error',
      });
    }
  },
);

export default router;

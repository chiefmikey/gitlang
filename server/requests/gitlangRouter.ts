import Router from '@koa/router';

import auth from '../helpers/github/auth';
import languages from '../helpers/github/languages';
import repositories from '../helpers/github/repositories';

const environmentToken = process.env.GH_PAT;

const router = new Router({ prefix: '/github' });

router.get(
  '/langs',
  async (context: {
    request: { query: { owner: string; repos: string } };
    response: { status: number; body: string };
  }) => {
    try {
      const token = environmentToken || (await auth());
      const { owner } = context.request.query;
      const { repos } = context.request.query;
      const repoList = JSON.parse(repos) as string[];
      const response = await languages(owner, repoList, token);
      if (response && response.length > 0) {
        context.response.status = 200;
        context.response.body = JSON.stringify(response);
      } else {
        context.response.status = 404;
        context.response.body = JSON.stringify([]);
      }
    } catch {
      context.response.status = 404;
      context.response.body = JSON.stringify([]);
    }
  },
);

router.get(
  '/repos',
  async (context: {
    request: { query: { username: string } };
    response: { status: number; body: string };
  }) => {
    try {
      const token = environmentToken || (await auth());
      const { username } = context.request.query;
      const response = await repositories(username, token);
      if (response && response.length > 0) {
        context.response.status = 200;
        context.response.body = JSON.stringify(response);
      } else {
        context.response.status = 404;
        context.response.body = JSON.stringify([]);
      }
    } catch {
      context.response.status = 404;
      context.response.body = JSON.stringify([]);
    }
  },
);

export default router;

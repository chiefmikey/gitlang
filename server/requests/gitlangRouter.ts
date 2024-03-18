import Router from '@koa/router';

import auth from '../helpers/github/auth';
import languages from '../helpers/github/languages';
import repositories from '../helpers/github/repositories';

const environmentToken = process.env.GH_PAT;

const router = new Router({ prefix: '/github' });

const setResponse = (
  context: { response: { status: number; body: string } },
  data: Array<{ [key: string]: number }> | string[],
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
  '/langs',
  async (context: {
    request: { query: { owner: string; repos: string } };
    response: { status: number; body: string };
  }) => {
    try {
      const token = environmentToken ?? (await auth());
      const { owner, repos } = context.request.query;
      const repoList = JSON.parse(repos) as string[];
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
    request: { query: { username: string } };
    response: { status: number; body: string };
  }) => {
    try {
      const token = environmentToken ?? (await auth());
      const { username } = context.request.query;
      const response = await repositories(username, token);
      setResponse(context, response);
    } catch (error) {
      console.error('Error in /repos route:', error);
      setResponse(context, []);
    }
  },
);

export default router;

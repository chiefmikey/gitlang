/* eslint-disable no-param-reassign */
import Router from '@koa/router';
import process from '../helpers/process.js';
import getLanguages from '../github/languages.js';
import getRepos from '../github/repos.js';

const router = new Router({ prefix: '/get' });

router.get('/languages', async (ctx) => {
  try {
    console.log(ctx.request.query);
    const results = await getLanguages();
    ctx.response.status = 200;
    ctx.response.body = results;
  } catch (e) {
    console.error('error with get', e);
    ctx.response.status = 200;
  }
});

router.get('/repos', async (ctx) => {
  try {
    const shape = process(ctx.request.query.owner);
    const results = await getRepos(shape);
    ctx.response.status = 200;
    ctx.response.body = results;
  } catch (e) {
    console.error('error with get', e);
    ctx.response.status = 200;
  }
});

export default router;

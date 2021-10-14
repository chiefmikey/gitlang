import Router from '@koa/router';
import getLanguages from './requests/languages.js';
import getRepos from './requests/repos.js';
import allNames from './helpers/names.js';
import getSize from './helpers/size.js';

const router = new Router();

router.get('/languages', async (ctx) => {
  try {
    const { owner } = ctx.request.query;
    const repos = await getRepos(owner);
    const names = allNames(repos);
    const languages = await getLanguages(owner, names);
    const size = getSize(languages);
    ctx.response.status = 200;
    ctx.response.body = { names, size };
  } catch (e) {
    console.error('error with get', e);
    ctx.response.status = 200;
  }
});

export default router;

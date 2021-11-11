import Router from '@koa/router';
import send from 'koa-send';
import getLanguages from './requests/languages.js';
import getRepos from './requests/repos.js';
import allNames from './helpers/names.js';
import getSize from './helpers/size.js';

const router = new Router();

router.get('/languages', async (context) => {
  try {
    const { owner } = context.request.query;
    const repos = await getRepos(owner);
    const names = allNames(repos);
    const languages = await getLanguages(owner, names);
    const size = getSize(languages);
    context.response.status = 200;
    context.response.body = { names, size };
  } catch (error) {
    console.error('error with get', error);
    context.response.status = 200;
  }
});

router.get('/:owner', async (context) => {
  try {
    await send(context, '/index.html', { root: './client/public' });
  } catch (error) {
    console.error('error with get', error);
    context.response.status = 200;
  }
});
export default router;

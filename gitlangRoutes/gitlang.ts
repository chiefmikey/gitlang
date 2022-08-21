import Router from '@koa/router';

import gitlangRouter from './requests/gitlangRouter';

const router = new Router({ prefix: '/gitlang' });

router.use(gitlangRouter.routes(), gitlangRouter.allowedMethods());

export default router;

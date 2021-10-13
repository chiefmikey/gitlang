import Router from '@koa/router';
import getRouter from './requests/get.js';

const router = new Router({ prefix: '/' });

router.use(
  getRouter.routes(),
  getRouter.allowedMethods(),
);

export default router;

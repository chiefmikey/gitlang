/* eslint-disable no-param-reassign */
import Router from '@koa/router';
import process from '../helpers/process.js';
import { findUser, findPost } from '../../db/queries/find.js';

const router = new Router({ prefix: '/get' });

router.get('/user', async (ctx) => {
  try {
    const shape = process(ctx.request.query.something);
    const results = await findUser(shape);
    ctx.response.status = 200;
    ctx.response.body = results;
  } catch (error) {
    console.error('error with get', error);
    ctx.response.status = 200;
  }
});

router.get('/post', async (ctx) => {
  try {
    const shape = process(ctx.request.query.something);
    const results = await findPost(shape);
    ctx.response.status = 200;
    ctx.response.body = results;
  } catch (error) {
    console.error('error with get', error);
    ctx.response.status = 200;
  }
});

export default router;

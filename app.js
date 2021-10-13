import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import serve from 'koa-static';
import path from 'path';
import index from './routes/index.js';
import './db/index.js';

const port = process.env.PORT || 3000;

const app = new Koa();

app
  .use(
    cors({
      origin: '*',
      methods: 'GET, POST',
      allowedHeaders: '*',
      exposedHeaders: '*',
    }),
  )
  .use(bodyParser())
  .use(serve(path.join(path.resolve(), '/client/public')))
  .use(index.routes())
  .use(index.allowedMethods());

app.listen(port, () => console.log('Koa is listening on port', port));

export default app;

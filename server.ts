import cors from '@koa/cors';
import { config } from 'dotenv';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import gitlang from './routes/gitlang';

config();

const app = new Koa();

const port = 3000;

const corsOptions = {
  allowMethods: ['GET', 'POST'],
  maxAge: 600,
};

app
  .use(cors(corsOptions))
  .use(bodyParser())
  .use(gitlang.routes())
  .use(gitlang.allowedMethods())
  .listen(port, () => console.log(`Server port: ${port}`));

export default app;

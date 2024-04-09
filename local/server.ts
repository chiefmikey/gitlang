import { config } from 'dotenv';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import gitlang from '../server/gitlang';

config();

const app = new Koa();

const port = 3000;

app
  .use(bodyParser())
  .use(gitlang.routes())
  .use(gitlang.allowedMethods())
  .listen(port, () => console.log(`Server port: ${port}`));

export default app;

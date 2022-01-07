import Koa from 'koa';
import serve from 'koa-static';
import path from 'node:path';

const port = 3004;

const app = new Koa();

app.use(serve(path.join(path.resolve(), '/docs')));

app.listen(port, () => console.log('Koa is listening on port', port));

export default app;

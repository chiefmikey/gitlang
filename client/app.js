import Koa from 'koa';
import path from 'node:path';
import serve from 'koa-static';

const port = 3004;

const app = new Koa();

app.use(serve(path.join(path.resolve(), '/docs')));

app.listen(port, () => console.log('Koa is listening on port', port));

export default app;

const Koa = require('koa');
const app = new Koa();
const Router = require('koa-router');
const router = new Router();
const open = require("open");
app.port = 8080

const views = require('koa-views');

// Must be used before any router is used
app.use(views(__dirname));

router.get('/', async (ctx, next) => {
    await ctx.render('demo.html');
});
app.use(router.routes());
app.use(router.allowedMethods());

const server = app.listen(app.port, null, () => {
  open(`http://localhost:${app.port}`);
  console.log('This upload server is listening on port: %d', server.address().port);
});

const Koa = require('koa');
const app = new Koa();
const fileUploader = require('../fileUploader.js');
const Router = require('koa-router');
const router = new Router();
const cors = require("@koa/cors")
const config = require('../config/appConfig')

app.port = process.env.PORT || 8000;
app.context.db = require('../models/index')

app.use(cors({
  origin: (ctx) => {
    console.log(ctx.headers)
    const requestOriginWithoutPort = ctx.accept.headers.host.toLowerCase().replace(/:\d+$/, '');
    const whitelist = process.env.ALLOWED_ORIGIN_SUFFIX.split(',')
    for(const suffix of whitelist) {
      if (requestOriginWithoutPort.endsWith(suffix)) {
        return ctx.accept.headers.host
      }
    }
    return ''
  }
}))

app.use(fileUploader(config));

const views = require('koa-views');

// Must be used before any router is used
app.use(views(__dirname));

router.get('/', async (ctx, next) => {
    await ctx.render('demo.html');
});
app.use(router.routes());
app.use(router.allowedMethods());

const server = app.listen(app.port, null, () => {
  // open(`http://${app.host}:${app.port}`);
  console.log('This upload server is listening on port: %d', server.address().port);
});

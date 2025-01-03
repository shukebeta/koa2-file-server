const Koa = require('koa');
const app = new Koa();
const fileUploader = require('../fileUploader.js');
const Router = require('koa-router');
const router = new Router();
const cors = require("@koa/cors")
const config = require('../config/appConfig')
const jwtMiddleware = require('../middlewares/jwtMiddleware');

app.port = process.env.PORT || 8000;
app.context.db = require('../models')

app.use((ctx, next) => {
  const origin = ctx.headers['origin'];

  if (origin && ctx.request.query['test'] !== undefined) {
    // If 'Origin' header is present, it's likely a web request, so apply CORS middleware
    return cors({
      origin: (ctx) => {
        const requestOriginWithoutPort = origin.toLowerCase().replace(/:\d+$/, '');
        const whitelist = process.env.ALLOWED_ORIGIN_SUFFIX.split(',');
        for (const suffix of whitelist) {
          if (requestOriginWithoutPort.endsWith(suffix)) {
            return origin;
          }
        }
        return '';
      }
    })(ctx, next); // Call the CORS middleware
  } else {
    // If 'Origin' is not present, assume it's an app request, so apply JWT middleware
    return jwtMiddleware(ctx, next); // Call the JWT middleware
  }
});


app.use(fileUploader(config));

const views = require('koa-views');

// Must be used before any router is used
app.use(views(__dirname));

router.get('/config', async (ctx, next) => {
  if (ctx.request.query['test'] !== undefined ) {
    const {allowedSize, allowedExt} = config
    ctx.body = JSON.stringify({
      allowedSize,
      allowedExt,
    });
  } else {
    ctx.status = 400;
    ctx.body = 'invalid request'
  }
});
router.get('/', async (ctx, next) => {
    if (ctx.request.query['test'] !== undefined ) {
      await ctx.render('demo.html');
    } else {
      ctx.status = 400;
      ctx.body = 'invalid request'
    }
});
app.use(router.routes());
app.use(router.allowedMethods());

const server = app.listen(app.port, null, () => {
  console.log('This upload server is listening on port: %d', server.address().port);
});

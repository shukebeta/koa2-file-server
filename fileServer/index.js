const Koa = require('koa');
const app = new Koa();
const fileUploader = require('../fileUploader.js');
const Router = require('koa-router');
const router = new Router();
const cors = require("@koa/cors")
const config = require('../config/appConfig')
const jwtMiddleware = require('../middlewares/jwtMiddleware');

app.port = process.env.PORT || 8000;
app.context.db = require('../models/index')

app.use((ctx, next) => {
  const origin = ctx.headers['origin'];

  if (origin) {
    // If 'Origin' header is present, it's likely a web request, so apply CORS middleware
    return cors({
      origin: (ctx) => {
        const requestOriginWithoutPort = origin.toLowerCase().replace(/:\d+$/, '');
        const whitelist = process.env.ALLOWED_ORIGIN_SUFFIX.split(',');
        for (const suffix of whitelist) {
          if (requestOriginWithoutPort.endsWith(suffix)) {
            return ctx.accept.headers.host;
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

router.get('/', async (ctx, next) => {
    await ctx.render('demo.html');
});
app.use(router.routes());
app.use(router.allowedMethods());

const server = app.listen(app.port, null, () => {
  // open(`http://${app.host}:${app.port}`);
  console.log('This upload server is listening on port: %d', server.address().port);
});

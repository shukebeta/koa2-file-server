const Koa = require('koa');
const app = new Koa();
const Router = require('koa-router');
const router = new Router();
const config = require('./config/appConfig');
const jwtMiddleware = require('./middlewares/jwtMiddleware');
const cors = require('@koa/cors');
const views = require('koa-views');
const path = require('path');

// Set port from environment or default to 8000
app.port = process.env.PORT || 3000;

// Attach database models to app context
app.context.db = require('./models');

// Conditional CORS and JWT Middleware based on request origin
app.use(async (ctx, next) => {
  const origin = ctx.headers['origin'];

  if (origin && ctx.request.query['test'] !== undefined) {
    // Apply CORS middleware for web requests with 'test' query parameter
    return cors({
      origin: (ctx) => {
        const requestOriginWithoutPort = origin.toLowerCase().replace(/:\d+$/, '');
        const whitelist = process.env.ALLOWED_ORIGIN_SUFFIX ? process.env.ALLOWED_ORIGIN_SUFFIX.split(',') : [];
        for (const suffix of whitelist) {
          if (requestOriginWithoutPort.endsWith(suffix)) {
            return origin;
          }
        }
        return '';
      }
    })(ctx, next);
  } else {
    // Apply JWT middleware for other requests (assumed to be app requests)
    return jwtMiddleware(ctx, next);
  }
});

// File upload middleware
const fileUploader = require('./upload/fileUploader');
app.use(fileUploader(config));

// Setup views for rendering HTML templates
app.use(views(path.join(__dirname, 'fileServer')));

// Use routes defined in the routes directory
const routes = require('./routes/index');
router.use(routes.routes());
router.use(routes.allowedMethods());

// Apply routes to the app
app.use(router.routes());
app.use(router.allowedMethods());

// Start the server
const server = app.listen(app.port, () => {
  console.log('This upload server is listening on port: %d', server.address().port);
});

module.exports = app;
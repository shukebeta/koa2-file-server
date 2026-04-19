const Koa = require('koa');
const Router = require('koa-router');
const views = require('koa-views');
const path = require('path');
const config = require('./config/appConfig');
const jwtMiddleware = require('./middlewares/jwtMiddleware');
const { createBrowserCorsMiddleware } = require('./middlewares/browserCors');
const createUploadMiddleware = require('./upload/progressAwareUploader');
const { createProgressRouter, progressManager: defaultProgressManager } = require('./routes/progressRoutes');

function createApp(options = {}) {
  const app = new Koa();
  const router = new Router();
  const appConfig = options.config || config;
  const progressManager = options.progressManager || defaultProgressManager;

  app.port = process.env.PORT || 3000;
  app.context.db = options.db || require('./models');
  app.context.progressManager = progressManager;

  app.use(createBrowserCorsMiddleware(options));
  app.use(jwtMiddleware);
  app.use(createUploadMiddleware(appConfig, { progressManager }));
  app.use(views(path.join(__dirname, 'fileServer')));

  const routes = require('./routes/index');
  const progressRouter = createProgressRouter(progressManager);
  router.use(routes.routes());
  router.use(routes.allowedMethods());
  router.use(progressRouter.routes());
  router.use(progressRouter.allowedMethods());

  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

const app = createApp();

if (require.main === module) {
  const server = app.listen(app.port, () => {
    console.log('This upload server is listening on port: %d', server.address().port);
  });
}

module.exports = app;
module.exports.createApp = createApp;

const Router = require('koa-router');
const router = new Router();

/**
 * Defines the routes for the file server application.
 * Currently includes only the root endpoint for the demo page.
 */

// Config endpoint to output public configuration data
router.get('/config', async (ctx, next) => {
  if (ctx.request.query['test'] !== undefined) {
    const { allowedSize, allowedExt } = require('../config/appConfig');
    ctx.body = JSON.stringify({
      allowedSize,
      allowedExt,
    });
  } else {
    ctx.status = 400;
    ctx.body = 'invalid request';
  }
});

// Root endpoint to render the demo page
router.get('/', async (ctx, next) => {
  if (ctx.request.query['test'] !== undefined) {
    await ctx.render('demo.html');
  } else {
    ctx.status = 400;
    ctx.body = 'invalid request';
  }
});

module.exports = router;
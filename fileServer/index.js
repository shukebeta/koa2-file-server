require('dotenv').config()
const Koa = require('koa');
const app = new Koa();
const fileUploader = require('../fileUploader.js');
const Router = require('koa-router');
const router = new Router();
const cors = require("@koa/cors")
app.port = process.env.PORT || 8000;

app.context.db = require('../models/index')

app.use(cors({
  origin(ctx) {
    const requestOriginWithoutPort = ctx.accept.headers.origin.toLowerCase().replace(/:\d+$/, '');
    const whitelist = process.env.ALLOWED_ORIGIN_SUFFIX.split(',')
    for(const suffix of whitelist) {
      if (requestOriginWithoutPort.endsWith(suffix)) {
        return ctx.accept.headers.origin
      }
    }
    return ''
  }
}))

const config = {
  allowedSize: +process.env.MAX_FILE_SIZE || 512,
  allowedExt: process.env.ALLOWED_EXT && process.env.ALLOWED_EXT.split(',') || ['.png', '.jpg', '.gif'],
  destPath: process.env.DESTINATION,
  fileFieldName: process.env.FILE_FIELD_NAME || 'file',
  apiUri: process.env.API_URI || '/api/upload',
  apiUriMulti: process.env.API_URI_MULTI || '/api/uploadMulti',
}
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

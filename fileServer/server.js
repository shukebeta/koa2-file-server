require('dotenv').config()
const Koa = require('koa');
const app = new Koa();
const fileUploader = require('../index.js');
const path = require('path');
const Router = require('koa-router');
const router = new Router();
const open = require("open");
const cors = require("@koa/cors")
app.host = process.env.IP || 'localhost';
app.port = process.env.PORT || 8000;

app.use(cors({
  origin: process.env.ORIGIN
}))

const config = {
  allowedSize: +process.env.MAX_FILE_SIZE || 512,
  allowedExt: process.env.ALLOWED_EXT && process.env.ALLOWED_EXT.split(',') || ['.png', '.jpg', '.gif'],
  destPath: path.join(__dirname, process.env.DESTINATION || './static'),
  fileFieldName: process.env.FILE_FIELD_NAME || 'img',
  apiPath: process.env.API_URI || '/api/upload',
  saveAsMd5: !!process.env.SAVE_AS_MD5
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

const server = app.listen(app.port, app.host, () => {
  open(`${app.host}:${app.port}`);
  console.log('Koa server listening on %s:%d', server.address().address, server.address().port);
});

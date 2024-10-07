// jwtMiddleware.js
const config = require('../config/appConfig');
const jwt = require('jsonwebtoken');

const SECRET_KEY = config.jwtSecret;

const jwtMiddleware = async (ctx, next) => {
  const authHeader = ctx.headers['authorization'];

  if (!authHeader) {
    ctx.status = 401;
    ctx.body = { error: 'Authorization header is missing' };
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
     // 验证JWT Token
    ctx.state.user = jwt.verify(token, SECRET_KEY); // 把解码后的用户信息存储在ctx.state.user中供后续使用
    await next(); // 验证成功，继续执行后续中间件
  } catch (err) {
    ctx.status = 403; // Token无效或过期
    ctx.body = { error: 'Invalid or expired token' };
  }
}

const conditionalJwtMiddleware = async (ctx, next) => {
  if ((ctx.path === config.apiUri || ctx.path === config.apiUriMulti) && ctx.method === 'POST') {
    await jwtMiddleware(ctx, next);
  } else {
    await next()
  }
}

module.exports = conditionalJwtMiddleware;

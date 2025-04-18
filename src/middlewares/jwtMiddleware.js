const jwt = require('jsonwebtoken');
const config = require('../config/appConfig');

/**
 * JWT Middleware for authentication.
 * Validates JWT tokens in the Authorization header of incoming requests conditionally
 * for specific upload endpoints. If valid, attaches user information to the context;
 * otherwise, returns an unauthorized response.
 */
const jwtMiddleware = async (ctx, next) => {
  const authHeader = ctx.headers['authorization'];

  if (!authHeader) {
    ctx.status = 401;
    ctx.body = { error: 'Authorization header is missing' };
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify JWT Token
    ctx.state.user = jwt.verify(token, config.jwtSecret); // Store decoded user info in ctx.state.user for downstream use
    await next(); // Verification successful, proceed to next middleware
  } catch (err) {
    ctx.status = 403; // Token invalid or expired
    ctx.body = { error: 'Invalid or expired token' };
  }
};

/**
 * Conditional JWT Middleware to apply authentication only for upload endpoints.
 */
const conditionalJwtMiddleware = async (ctx, next) => {
  if ((ctx.path === config.apiUri || ctx.path === config.apiUriMulti) && ctx.method === 'POST') {
    await jwtMiddleware(ctx, next);
  } else {
    await next();
  }
};

module.exports = conditionalJwtMiddleware;
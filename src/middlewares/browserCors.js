const cors = require('@koa/cors');

function resolveAllowedOrigin(origin, allowedOriginSuffixes = process.env.ALLOWED_ORIGIN_SUFFIX || '') {
  if (!origin || typeof origin !== 'string') {
    return '';
  }

  const host = origin
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '');
  const whitelist = String(allowedOriginSuffixes)
    .split(',')
    .map((suffix) => suffix.trim().toLowerCase())
    .filter(Boolean);

  // Match on a domain boundary, not a raw string suffix: an origin is admitted
  // only when its hostname is exactly a whitelist entry or a subdomain of it,
  // so a distinct registrable domain like evilshukebeta.com is rejected.
  if (whitelist.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return origin;
  }

  return '';
}

function createBrowserCorsMiddleware(options = {}) {
  const allowedOriginSuffixes = options.allowedOriginSuffixes ?? process.env.ALLOWED_ORIGIN_SUFFIX ?? '';
  const corsMiddleware = cors({
    origin: (ctx) => resolveAllowedOrigin(ctx.headers.origin, allowedOriginSuffixes),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
    keepHeadersOnError: true,
  });

  return async (ctx, next) => {
    const origin = ctx.headers.origin;
    if (!origin) {
      return next();
    }

    if (!resolveAllowedOrigin(origin, allowedOriginSuffixes)) {
      return next();
    }

    return corsMiddleware(ctx, next);
  };
}

module.exports = {
  resolveAllowedOrigin,
  createBrowserCorsMiddleware,
};

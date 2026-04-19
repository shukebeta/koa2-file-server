const test = require('node:test');
const assert = require('node:assert/strict');
const Koa = require('koa');
const { once } = require('node:events');

const { resolveAllowedOrigin, createBrowserCorsMiddleware } = require('../src/middlewares/browserCors');

test('resolveAllowedOrigin accepts localhost with dynamic port', () => {
  assert.equal(resolveAllowedOrigin('http://localhost:49430', 'localhost,shukebeta.com'), 'http://localhost:49430');
  assert.equal(resolveAllowedOrigin('http://evil.example.com', 'localhost,shukebeta.com'), '');
});

test('browser preflight succeeds for whitelisted localhost origin', async (t) => {
  const app = new Koa();
  app.use(createBrowserCorsMiddleware({ allowedOriginSuffixes: 'localhost' }));
  app.use((ctx) => {
    ctx.status = 200;
    ctx.body = 'ok';
  });

  const server = app.listen(0);
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/upload`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:49430',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:49430');
  assert.match((response.headers.get('access-control-allow-methods') || '').toUpperCase(), /POST/);
  assert.match((response.headers.get('access-control-allow-headers') || '').toLowerCase(), /authorization/);
});

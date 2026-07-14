// The auth middleware requires appConfig at module load, and appConfig
// hard-throws when JWT_SECRET is unset. Set the env (and the other required
// vars, to silence their warnings) BEFORE requiring anything that pulls
// appConfig, and sign the valid-token case with this same secret. dotenv only
// fills unset vars, so these assignments win over any .env on the machine.
process.env.JWT_SECRET = 'test-secret-abc123';
process.env.DESTINATION = process.env.DESTINATION || '/tmp/koa-auth-test-dest';
process.env.IMG_SERVER = process.env.IMG_SERVER || 'https://example.com';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const Koa = require('koa');
const jwt = require('jsonwebtoken');

const conditionalJwtMiddleware = require('../src/middlewares/jwtMiddleware');

const SECRET = process.env.JWT_SECRET;

// Mounts the auth gate ahead of a terminal middleware that echoes whether the
// request reached it and what user the gate attached, so pass-through and
// ctx.state.user population are both observable.
async function startApp(t) {
  const app = new Koa();
  app.use(conditionalJwtMiddleware);
  app.use(async (ctx) => {
    ctx.status = 200;
    ctx.body = { reached: true, user: ctx.state.user || null };
  });

  const server = app.listen(0);
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });
  return server;
}

function url(server, p) {
  return `http://127.0.0.1:${server.address().port}${p}`;
}

test('auth: POST /api/upload without an Authorization header is rejected 401', async (t) => {
  const server = await startApp(t);
  const res = await fetch(url(server, '/api/upload'), { method: 'POST' });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /Authorization header is missing/);
});

test('auth: POST /api/upload with a wrong-secret token is rejected 403', async (t) => {
  const server = await startApp(t);
  const token = jwt.sign({ sub: 'u1' }, 'the-wrong-secret');
  const res = await fetch(url(server, '/api/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.match(body.error, /Invalid or expired token/);
});

test('auth: POST /api/upload with a malformed header is rejected 403', async (t) => {
  const server = await startApp(t);
  const res = await fetch(url(server, '/api/upload'), {
    method: 'POST',
    headers: { Authorization: 'Bearer not-a-jwt' },
  });
  assert.equal(res.status, 403);
});

test('auth: POST /api/upload with a valid token passes through and populates ctx.state.user', async (t) => {
  const server = await startApp(t);
  const token = jwt.sign({ sub: 'u1', name: 'alice' }, SECRET);
  const res = await fetch(url(server, '/api/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reached, true);
  assert.equal(body.user.sub, 'u1');
  assert.equal(body.user.name, 'alice');
});

test('auth: POST /api/uploadMulti is also gated', async (t) => {
  const server = await startApp(t);
  const res = await fetch(url(server, '/api/uploadMulti'), { method: 'POST' });
  assert.equal(res.status, 401);
});

test('auth: a GET to /api/upload passes through without a token (only POST is gated)', async (t) => {
  const server = await startApp(t);
  const res = await fetch(url(server, '/api/upload'), { method: 'GET' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reached, true);
  assert.equal(body.user, null);
});

test('auth: a non-upload path passes through without a token', async (t) => {
  const server = await startApp(t);
  const res = await fetch(url(server, '/api/progress/abc'), { method: 'POST' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reached, true);
});

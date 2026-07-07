const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const Koa = require('koa');
const { once } = require('node:events');

const { ProgressManager, createProgressRouter } = require('../src/routes/progressRoutes');
const { createBrowserCorsMiddleware } = require('../src/middlewares/browserCors');

// Mirror src/app.js wiring: the global browser CORS middleware runs before the
// progress router, and createProgressRouter makes its own origin decision for the
// SSE route (because it bypasses Koa's response with ctx.respond = false).
function createProgressApp(options = {}) {
  const progressManager = options.progressManager || new ProgressManager({
    initialCleanupMs: 50,
    terminalCleanupMs: 50,
  });
  const allowedOriginSuffixes = options.allowedOriginSuffixes ?? 'localhost,shukebeta.com';
  const app = new Koa();
  app.context.progressManager = progressManager;
  app.use(createBrowserCorsMiddleware({ allowedOriginSuffixes }));
  const router = createProgressRouter(progressManager, { allowedOriginSuffixes });
  app.use(router.routes());
  app.use(router.allowedMethods());
  return { app, progressManager };
}

async function startServer(t, app) {
  const server = app.listen(0);
  await once(server, 'listening');
  t.after(async () => {
    // Force-close lingering SSE / keep-alive sockets so server.close() resolves
    // promptly (otherwise it waits out keepAliveTimeout per open response).
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  });
  return server;
}

async function openSse(t, server, uploadId, origin) {
  const controller = new AbortController();
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/progress/${uploadId}`, {
    headers: { Origin: origin },
    signal: controller.signal,
  });

  // The SSE body stays open; cancel it (and abort the request) so server.close()
  // does not hang waiting on the lingering stream.
  const reader = response.body.getReader();
  t.after(async () => {
    controller.abort();
    try {
      await reader.cancel();
    } catch (error) {
      // Ignore cancellation errors after abort.
    }
  });

  return response;
}

test('SSE route grants no cross-origin header to a disallowed origin', async (t) => {
  const { app } = createProgressApp();
  const server = await startServer(t, app);

  const response = await openSse(t, server, 'evil-id', 'http://evil.example.com');

  assert.equal(response.status, 200);
  // Regression for the hardcoded 'Access-Control-Allow-Origin: *'.
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('vary'), null);
});

test('SSE route echoes only a whitelisted origin', async (t) => {
  const { app } = createProgressApp({ allowedOriginSuffixes: 'localhost,shukebeta.com' });
  const server = await startServer(t, app);

  const response = await openSse(t, server, 'ok-id', 'http://localhost:49430');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:49430');
  assert.match(response.headers.get('vary') || '', /Origin/);
});

test('status route grants no cross-origin header to a disallowed origin', async (t) => {
  const progressManager = new ProgressManager({
    initialCleanupMs: 50,
    terminalCleanupMs: 50,
  });
  progressManager.complete('leak-id', {
    result: { url: 'https://img.example.com/x.png', path: '/x.png', md5: 'abc', fileExt: '.png' },
  });
  const { app } = createProgressApp({ progressManager });
  const server = await startServer(t, app);

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/upload/status/leak-id`, {
    headers: { Origin: 'http://evil.example.com' },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  // The result payload is still returned to a direct request (capability-token
  // model: whoever knows the unguessable uploadId may read it), but NO cross-origin
  // header is granted, so a browser on evil.example.com cannot read the response.
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(body.result, {
    url: 'https://img.example.com/x.png', path: '/x.png', md5: 'abc', fileExt: '.png',
  });
});

test('generateUploadId is a high-entropy capability token, not timestamp+Math.random', async () => {
  const html = await fs.readFile(path.join(__dirname, '../src/fileServer/demo.html'), 'utf8');

  // Source guard: the weak primitives must not appear in the generator.
  const fnMatch = html.match(/function generateUploadId\(\) \{[\s\S]*?\n {8}\}/);
  assert.ok(fnMatch, 'generateUploadId must exist in demo.html');
  const fnSource = fnMatch[0];
  assert.doesNotMatch(fnSource, /Math\.random/, 'uploadId must not use Math.random()');
  assert.doesNotMatch(fnSource, /Date\.now/, 'uploadId must not use Date.now()');

  // Behaviour guard: execute the extracted generator with a CSPRNG-backed crypto.
  const sandbox = { crypto: globalThis.crypto, Uint8Array, Array };
  vm.createContext(sandbox);
  const id = vm.runInContext(`(function () { ${fnSource}\n return generateUploadId(); })()`, sandbox);

  assert.equal(typeof id, 'string');
  assert.ok(id.length >= 32, `uploadId too short to be a capability secret: ${id}`);
  assert.doesNotMatch(id, /^upload_\d+_[a-z0-9]{9}$/, `uploadId is still the weak form: ${id}`);
  assert.match(id, /^[0-9a-f-]+$/i, `uploadId is not hex/uuid: ${id}`);
});

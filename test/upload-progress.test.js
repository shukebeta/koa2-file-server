const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const Koa = require('koa');

const createUploadMiddleware = require('../src/upload/progressAwareUploader');
const { ProgressManager, createProgressRouter } = require('../src/routes/progressRoutes');

function buildConfig(destPath) {
  return {
    allowedSize: 1024,
    allowedExt: ['.txt'],
    destPath,
    fileFieldName: 'img',
    apiUri: '/api/upload',
    apiUriMulti: '/api/uploadMulti',
    maxImageNarrowSide: 1600,
  };
}

function createMockFileService() {
  return {
    getHashDir() {
      return '/00/00/';
    },
    async processFiles(files) {
      return files.map((file) => ({
        url: `https://example.com/${file.originalname}`,
        originalName: file.originalname,
        fileSize: file.size,
        path: `/mock/${file.originalname}`,
        md5: `md5-${file.originalname}`,
        fileExt: path.extname(file.originalname),
      }));
    },
  };
}

async function createUploadHarness(t, options = {}) {
  const destPath = await fs.mkdtemp(path.join(os.tmpdir(), 'koa-upload-test-'));
  const progressManager = options.progressManager || new ProgressManager({
    initialCleanupMs: 10_000,
    terminalCleanupMs: 10_000,
  });
  const app = new Koa();
  app.context.db = {};
  app.context.progressManager = progressManager;
  app.use(createUploadMiddleware(buildConfig(destPath), {
    fileService: createMockFileService(),
    progressManager,
  }));

  const server = app.listen(0);
  await once(server, 'listening');

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(destPath, { recursive: true, force: true });
  });

  return {
    progressManager,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function postFiles(url, files, fields = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  for (const file of files) {
    form.append('img', new Blob([file.contents], { type: 'text/plain' }), file.name);
  }

  const response = await fetch(url, {
    method: 'POST',
    body: form,
  });

  return {
    response,
    body: await response.json(),
  };
}

async function readChunk(reader) {
  const { value, done } = await Promise.race([
    reader.read(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for SSE chunk')), 2_000)),
  ]);

  assert.equal(done, false);
  return Buffer.from(value).toString('utf8');
}

test('single upload still succeeds without progress tracking', async (t) => {
  const { baseUrl } = await createUploadHarness(t);
  const { response, body } = await postFiles(`${baseUrl}/api/upload`, [
    { name: 'single.txt', contents: 'hello world' },
  ]);

  assert.equal(response.status, 200);
  assert.equal(body.errorCode, 0);
  assert.equal(body.data.originalName, 'single.txt');
  assert.equal(body.data.fileExt, '.txt');
});

test('multi upload still succeeds without progress tracking', async (t) => {
  const { baseUrl } = await createUploadHarness(t);
  const { response, body } = await postFiles(`${baseUrl}/api/uploadMulti`, [
    { name: 'first.txt', contents: 'alpha' },
    { name: 'second.txt', contents: 'beta' },
  ]);

  assert.equal(response.status, 200);
  assert.equal(body.errorCode, 0);
  assert.equal(body.data.length, 2);
  assert.deepEqual(body.data.map((item) => item.originalName), ['first.txt', 'second.txt']);
});

test('uploadId sent as multipart field is tracked after Multer parsing', async (t) => {
  const progressManager = new ProgressManager({
    initialCleanupMs: 10_000,
    terminalCleanupMs: 10_000,
  });
  const { baseUrl } = await createUploadHarness(t, { progressManager });

  const { response, body } = await postFiles(`${baseUrl}/api/upload`, [
    { name: 'tracked.txt', contents: 'tracked payload' },
  ], {
    uploadId: 'body-upload-id',
  });

  assert.equal(response.status, 200);
  assert.equal(body.errorCode, 0);

  const snapshot = progressManager.getSnapshot('body-upload-id');
  assert.ok(snapshot);
  assert.equal(snapshot.status, 'completed');
  assert.equal(snapshot.progress, 1);
  assert.equal(snapshot.result.originalName, 'tracked.txt');
});

test('progress SSE route stays open and emits lifecycle events', async (t) => {
  const progressManager = new ProgressManager({
    initialCleanupMs: 10_000,
    terminalCleanupMs: 10_000,
  });
  const app = new Koa();
  const router = createProgressRouter(progressManager);
  app.use(router.routes());
  app.use(router.allowedMethods());

  const server = app.listen(0);
  await once(server, 'listening');

  const controller = new AbortController();
  t.after(() => {
    controller.abort();
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/progress/sse-upload`, {
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream');

  const reader = response.body.getReader();
  t.after(async () => {
    try {
      await reader.cancel();
    } catch (error) {
      // Ignore cancellation errors after abort.
    }
  });

  const firstChunk = await readChunk(reader);
  assert.match(firstChunk, /"type":"connected"/);

  progressManager.startUpload('sse-upload', { fileSize: 100 });
  progressManager.markProcessing('sse-upload', { fileSize: 100, receivedBytes: 100 });

  const secondChunk = await readChunk(reader);
  assert.match(secondChunk, /"status":"(uploading|processing)"/);

  controller.abort();
});


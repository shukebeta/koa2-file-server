const Router = require('koa-router');

class ProgressManager {
  constructor(options = {}) {
    this.uploads = new Map();
    this.clients = new Map();
    this.cleanupTimers = new Map();
    this.initialCleanupMs = options.initialCleanupMs ?? 30 * 60 * 1000;
    this.terminalCleanupMs = options.terminalCleanupMs ?? 60 * 1000;
    this.now = options.now || (() => Date.now());
    this.setTimer = options.setTimer || setTimeout;
    this.clearTimer = options.clearTimer || clearTimeout;
  }

  ensureUpload(uploadId, seed = {}) {
    if (!uploadId) {
      return null;
    }

    if (!this.uploads.has(uploadId)) {
      this.uploads.set(uploadId, {
        id: uploadId,
        fileSize: 0,
        receivedBytes: 0,
        progress: 0,
        status: 'pending',
        startTime: this.now(),
        ...seed,
      });
    }

    return this.uploads.get(uploadId);
  }

  getUpload(uploadId) {
    return this.uploads.get(uploadId) || null;
  }

  startUpload(uploadId, { fileSize = 0 } = {}) {
    return this.updateProgress(uploadId, {
      status: 'uploading',
      progress: 0,
      fileSize,
      receivedBytes: 0,
      startTime: this.now(),
    }, { createIfMissing: true, cleanupMs: this.initialCleanupMs });
  }

  markProcessing(uploadId, { fileSize, receivedBytes } = {}) {
    const updates = {
      status: 'processing',
      progress: 0.9,
    };

    if (typeof fileSize === 'number' && fileSize >= 0) {
      updates.fileSize = fileSize;
    }

    if (typeof receivedBytes === 'number' && receivedBytes >= 0) {
      updates.receivedBytes = receivedBytes;
    }

    return this.updateProgress(uploadId, updates, { createIfMissing: true });
  }

  complete(uploadId, { result } = {}) {
    const upload = this.ensureUpload(uploadId);
    if (!upload) {
      return null;
    }

    return this.updateProgress(uploadId, {
      status: 'completed',
      progress: 1,
      receivedBytes: upload.fileSize || upload.receivedBytes,
      result,
    }, { createIfMissing: true, cleanupMs: this.terminalCleanupMs });
  }

  fail(uploadId, error) {
    const upload = this.ensureUpload(uploadId);
    if (!upload) {
      return null;
    }

    return this.updateProgress(uploadId, {
      status: 'error',
      error,
    }, { createIfMissing: true, cleanupMs: this.terminalCleanupMs });
  }

  updateProgress(uploadId, updates = {}, options = {}) {
    if (!uploadId) {
      return null;
    }

    const upload = options.createIfMissing ? this.ensureUpload(uploadId) : this.getUpload(uploadId);
    if (!upload) {
      return null;
    }

    Object.assign(upload, updates, { lastUpdate: this.now() });
    this.broadcastProgress(uploadId);

    if (typeof options.cleanupMs === 'number') {
      this.scheduleCleanup(uploadId, options.cleanupMs);
    }

    return upload;
  }

  getSnapshot(uploadId) {
    const upload = this.getUpload(uploadId);
    return upload ? this.serializeUpload(uploadId, upload) : null;
  }

  addClient(uploadId, response) {
    if (!this.clients.has(uploadId)) {
      this.clients.set(uploadId, new Set());
    }

    this.clients.get(uploadId).add(response);
    this.writeEvent(response, {
      type: 'connected',
      uploadId,
      timestamp: this.now(),
    });

    const snapshot = this.getSnapshot(uploadId);
    if (snapshot) {
      this.writeEvent(response, snapshot);
    }
  }

  removeClient(uploadId, response) {
    const clients = this.clients.get(uploadId);
    if (!clients) {
      return;
    }

    clients.delete(response);
    if (clients.size === 0) {
      this.clients.delete(uploadId);
    }
  }

  broadcastProgress(uploadId) {
    const clients = this.clients.get(uploadId);
    const snapshot = this.getSnapshot(uploadId);
    if (!clients || !snapshot) {
      return;
    }

    for (const client of Array.from(clients)) {
      try {
        this.writeEvent(client, snapshot);
      } catch (error) {
        this.removeClient(uploadId, client);
      }
    }
  }

  writeEvent(response, payload) {
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  serializeUpload(uploadId, upload) {
    const computedProgress = typeof upload.progress === 'number'
      ? upload.progress
      : (upload.fileSize > 0 ? upload.receivedBytes / upload.fileSize : (upload.status === 'completed' ? 1 : 0));

    return {
      uploadId,
      progress: clampProgress(computedProgress),
      status: upload.status,
      receivedBytes: upload.receivedBytes,
      fileSize: upload.fileSize,
      error: upload.error,
      result: upload.result,
      timestamp: upload.lastUpdate || upload.startTime,
    };
  }

  scheduleCleanup(uploadId, cleanupMs) {
    const existingTimer = this.cleanupTimers.get(uploadId);
    if (existingTimer) {
      this.clearTimer(existingTimer);
    }

    const timer = this.setTimer(() => {
      this.cleanup(uploadId);
    }, cleanupMs);

    this.cleanupTimers.set(uploadId, timer);
  }

  cleanup(uploadId) {
    const timer = this.cleanupTimers.get(uploadId);
    if (timer) {
      this.clearTimer(timer);
      this.cleanupTimers.delete(uploadId);
    }

    const clients = this.clients.get(uploadId);
    if (clients) {
      for (const client of Array.from(clients)) {
        try {
          client.end();
        } catch (error) {
          // Ignore disconnect errors during cleanup.
        }
      }
    }

    this.clients.delete(uploadId);
    this.uploads.delete(uploadId);
  }
}

function clampProgress(progress) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  if (progress < 0) {
    return 0;
  }

  if (progress > 1) {
    return 1;
  }

  return progress;
}

function createProgressRouter(progressManager) {
  const router = new Router();

  router.get('/api/progress/:uploadId', async (ctx) => {
    const { uploadId } = ctx.params;

    ctx.req.setTimeout(0);
    ctx.respond = false;
    ctx.status = 200;
    ctx.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    if (typeof ctx.res.flushHeaders === 'function') {
      ctx.res.flushHeaders();
    }

    progressManager.addClient(uploadId, ctx.res);

    const removeClient = () => {
      progressManager.removeClient(uploadId, ctx.res);
    };

    ctx.req.on('close', removeClient);
    ctx.req.on('error', removeClient);
  });

  router.get('/api/upload/status/:uploadId', async (ctx) => {
    const { uploadId } = ctx.params;
    const snapshot = progressManager.getSnapshot(uploadId);

    if (!snapshot) {
      ctx.status = 404;
      ctx.body = { error: 'Upload not found' };
      return;
    }

    ctx.body = snapshot;
  });

  return router;
}

const progressManager = new ProgressManager();
const router = createProgressRouter(progressManager);

module.exports = {
  ProgressManager,
  createProgressRouter,
  progressManager,
  router,
};

const multer = require('@koa/multer');
const path = require('path');
const { SuccessResult, ErrorResult } = require('../api/ApiResult');
const DefaultFileService = require('../services/fileService');
const { createDirectory: defaultCreateDirectory } = require('../lib/utils');

function createUploadMiddleware(config = {}, deps = {}) {
  const fileService = deps.fileService || new (deps.FileService || DefaultFileService)(config);
  const progressManager = deps.progressManager;
  const createDirectory = deps.createDirectory || defaultCreateDirectory;
  const multerFactory = deps.multer || multer;

  const storage = multerFactory.diskStorage({
    destination: async (req, file, callback) => {
      const savePath = config.destPath + '/tmp/uploadedFiles' + fileService.getHashDir();
      try {
        await createDirectory(savePath);
        callback(null, savePath);
      } catch (error) {
        callback(error);
      }
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  });

  const fileFilter = (req, file, cb) => {
    const extName = path.extname(file.originalname).toLowerCase().trim();
    if (config.allowedExt && config.allowedExt.length && !config.allowedExt.includes(extName)) {
      cb(new FileTypeError(`Only ${config.allowedExt.join(',')} files are allowed to upload.`));
    } else {
      cb(null, true);
    }
  };

  const upload = multerFactory({
    storage,
    fileFilter,
    limits: {
      fileSize: config.allowedSize * 1024
    }
  });

  return async (ctx, next) => {
    if (ctx.method !== 'POST' || !(ctx.path === config.apiUri || ctx.path === config.apiUriMulti)) {
      return next();
    }

    const queryUploadId = normalizeUploadId(ctx.query.uploadId);
    const contentLength = parseContentLength(ctx.headers['content-length']);
    const activeProgressManager = progressManager || ctx.app.context.progressManager;

    if (activeProgressManager && queryUploadId) {
      activeProgressManager.startUpload(queryUploadId, { fileSize: contentLength });
      // Multer/busboy attaches its own data listener on ctx.req (flowing mode),
      // so this second listener sees the same body chunks and can report
      // incremental transfer progress while Multer still streams to disk.
      attachByteTracker(ctx.req, activeProgressManager, queryUploadId);
    }

    try {
      const isSingle = ctx.path === config.apiUri;
      await upload[isSingle ? 'single' : 'array'](config.fileFieldName)(ctx, async () => {});

      const bodyUploadId = normalizeUploadId(ctx.request.body && ctx.request.body.uploadId);
      const uploadId = queryUploadId || bodyUploadId;

      if (activeProgressManager && uploadId && !queryUploadId) {
        activeProgressManager.startUpload(uploadId, { fileSize: contentLength });
      }

      const files = isSingle ? [ctx.request.file] : ctx.request.files;
      if (!files || !files.length || !files[0]) {
        if (activeProgressManager && uploadId) {
          activeProgressManager.fail(uploadId, 'None of your files were uploaded.');
        }
        ctx.body = ErrorResult(1001, 'None of your files were uploaded.');
        return;
      }

      if (activeProgressManager && uploadId) {
        activeProgressManager.markProcessing(uploadId, {
          fileSize: contentLength,
          receivedBytes: contentLength,
        });
      }

      const maxNarrowSideOverride = ctx.query.maxNarrowSide || (ctx.request.body && ctx.request.body.maxNarrowSide);
      const data = await fileService.processFiles(files, ctx.db, maxNarrowSideOverride);

      if (activeProgressManager && uploadId) {
        activeProgressManager.complete(uploadId, {
          result: isSingle ? data[0] : data,
        });
      }

      ctx.body = data.length
        ? SuccessResult(isSingle ? data[0] : data)
        : ErrorResult(1001, 'None of your files were uploaded.');
    } catch (err) {
      console.error('Upload error:', err);

      const bodyUploadId = normalizeUploadId(ctx.request.body && ctx.request.body.uploadId);
      const uploadId = queryUploadId || bodyUploadId;
      if (activeProgressManager && uploadId) {
        activeProgressManager.fail(uploadId, err.message || 'Unknown upload error');
      }

      if (err instanceof FileTypeError || err.code === 'FILE_TYPE_ERROR') {
        ctx.body = ErrorResult(9111, err.message);
      } else if (err.code === 'LIMIT_FILE_SIZE') {
        ctx.body = ErrorResult(9113, `File is larger than ${config.allowedSize}KB`);
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        ctx.body = ErrorResult(9114, `Unexpected fileFieldName: ${config.fileFieldName}`);
      } else {
        ctx.body = ErrorResult(9115, err.message || 'Unknown upload error');
      }
    }
  };
}

function normalizeUploadId(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  return trimmed || '';
}

function parseContentLength(value) {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

// Accumulates request-body bytes and forwards them to the progress manager so
// SSE clients see incremental transfer progress. Detaches itself when the stream
// ends, errors, or closes so the listener never outlives the request.
function attachByteTracker(req, progressManager, uploadId) {
  let receivedBytes = 0;

  const onData = (chunk) => {
    if (chunk && chunk.length) {
      receivedBytes += chunk.length;
      progressManager.recordReceivedBytes(uploadId, receivedBytes);
    }
  };

  const detach = () => {
    req.off('data', onData);
    req.off('end', detach);
    req.off('error', detach);
    req.off('close', detach);
  };

  req.on('data', onData);
  req.on('end', detach);
  req.on('error', detach);
  req.on('close', detach);
}

class FileTypeError extends Error {
  constructor(message) {
    super(message);
    this.code = 'FILE_TYPE_ERROR';
    this.name = 'FileTypeError';
  }
}

module.exports = createUploadMiddleware;
module.exports.createUploadMiddleware = createUploadMiddleware;
module.exports.FileTypeError = FileTypeError;

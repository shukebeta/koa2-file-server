const multer = require('@koa/multer');
const path = require('path');
const { SuccessResult, ErrorResult } = require('../api/ApiResult');
const FileService = require('../services/fileService');

/**
 * File upload middleware for handling single and multiple file uploads.
 * Uses multer for file handling and delegates processing to FileService.
 */
module.exports = (config = {}) => {
  const fileService = new FileService(config);

  const storage = multer.diskStorage({
    destination: async (req, file, callback) => {
      const savePath = config.destPath + '/tmp/uploadedFiles' + fileService.getHashDir();
      try {
        await require('../lib/utils').createDirectory(savePath);
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

  const upload = multer({
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

    try {
      const isSingle = ctx.path === config.apiUri;
      await upload[isSingle ? 'single' : 'array'](config.fileFieldName)(ctx, next);

      const files = isSingle ? [ctx.request.file] : ctx.request.files;
      if (!files || !files.length || !files[0]) {
        ctx.body = ErrorResult(1001, 'None of your files were uploaded.');
        return;
      }

      const data = await fileService.processFiles(files, ctx.db);
      ctx.body = data.length ?
        SuccessResult(isSingle ? data[0] : data) :
        ErrorResult(1001, 'None of your files were uploaded.');
    } catch (err) {
      console.error('Upload error:', err);

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
};

class FileTypeError extends Error {
  constructor(message) {
    super(message);
    this.code = 'FILE_TYPE_ERROR';
    this.name = 'FileTypeError';
  }
}
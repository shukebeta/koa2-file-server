const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  allowedSize: +process.env.MAX_FILE_SIZE || 512,
  allowedExt: process.env.ALLOWED_EXT?.split(',') || ['.png', '.jpg', '.gif'],
  destPath: process.env.DESTINATION,
  fileFieldName: process.env.FILE_FIELD_NAME || 'file',
  apiUri: process.env.API_URI || '/api/upload',
  apiUriMulti: process.env.API_URI_MULTI || '/api/uploadMulti',
};

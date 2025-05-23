const dotenv = require('dotenv');
dotenv.config();

/**
 * Application configuration object, centralizing settings from environment variables.
 * Each property is documented for clarity on purpose and expected values.
 */
const config = {
  /**
   * Maximum allowed file size for uploads in KB.
   * Must be a positive number. Defaults to 512 KB if not specified.
   */
  allowedSize: validatePositiveNumber(process.env.MAX_FILE_SIZE, 512, 'MAX_FILE_SIZE'),

  /**
   * Array of allowed file extensions for uploads (e.g., ['.png', '.jpg']).
   * Must be a non-empty array. Defaults to common image extensions if not specified.
   */
  allowedExt: validateArray(process.env.ALLOWED_EXT?.split(','), ['.png', '.jpg', '.gif', '.jpeg', '.webp'], 'ALLOWED_EXT'),

  /**
   * Destination path for storing uploaded files.
   * Must be specified in environment variables; no default provided to ensure explicit configuration.
   */
  destPath: validateRequiredString(process.env.DESTINATION, 'DESTINATION'),

  /**
   * Field name used for file uploads in multipart form data.
   * Defaults to 'file' if not specified.
   */
  fileFieldName: process.env.FILE_FIELD_NAME || 'file',

  /**
   * API endpoint URI for single file upload.
   * Defaults to '/api/upload' if not specified.
   */
  apiUri: process.env.API_URI || '/api/upload',

  /**
   * API endpoint URI for multiple file upload.
   * Defaults to '/api/uploadMulti' if not specified.
   */
  apiUriMulti: process.env.API_URI_MULTI || '/api/uploadMulti',

  /**
   * Secret key for JWT authentication.
   * Must be specified in environment variables; throws error if not set to prevent insecure defaults.
   */
  jwtSecret: validateRequiredString(process.env.JWT_SECRET, 'JWT_SECRET', true),

  /**
   * Base URL for the image server hosting uploaded files.
   * Must be specified in environment variables; placeholder text as default to prompt configuration.
   */
  imgServer: validateRequiredString(process.env.IMG_SERVER, 'IMG_SERVER', false, 'to be defined in .env'),

  /**
   * Maximum dimension for the narrow side of uploaded images in pixels.
   * Used for resizing to reduce file size.
   * Must be a positive number. Defaults to 1600 pixels if not specified.
   */
  maxImageNarrowSide: validatePositiveNumber(process.env.MAX_IMAGE_NARROW_SIDE, 1600, 'MAX_IMAGE_NARROW_SIDE'),
};

/**
 * Validates that a value is a positive number, returning a default if invalid.
 * @param {string|number} value - The value to validate.
 * @param {number} defaultValue - Default value if validation fails.
 * @param {string} envVarName - Name of the environment variable for error messaging.
 * @returns {number} Validated positive number.
 */
function validatePositiveNumber(value, defaultValue, envVarName) {
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    console.warn(`Warning: ${envVarName} must be a positive number. Using default value: ${defaultValue}`);
    return defaultValue;
  }
  return num;
}

/**
 * Validates that a value is a non-empty array, returning a default if invalid.
 * @param {Array} value - The value to validate.
 * @param {Array} defaultValue - Default value if validation fails.
 * @param {string} envVarName - Name of the environment variable for error messaging.
 * @returns {Array} Validated non-empty array.
 */
function validateArray(value, defaultValue, envVarName) {
  if (!Array.isArray(value) || value.length === 0) {
    console.warn(`Warning: ${envVarName} must be a non-empty array. Using default value: ${JSON.stringify(defaultValue)}`);
    return defaultValue;
  }
  return value;
}

/**
 * Validates that a value is a non-empty string, throwing an error or returning a default if invalid.
 * @param {string} value - The value to validate.
 * @param {string} envVarName - Name of the environment variable for error messaging.
 * @param {boolean} throwError - Whether to throw an error if validation fails.
 * @param {string} defaultValue - Default value if validation fails and no error is thrown.
 * @returns {string} Validated non-empty string.
 * @throws {Error} If validation fails and throwError is true.
 */
function validateRequiredString(value, envVarName, throwError = false, defaultValue = '') {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    if (throwError) {
      throw new Error(`Error: ${envVarName} must be a non-empty string and is required for secure operation.`);
    } else {
      console.warn(`Warning: ${envVarName} must be a non-empty string. Using default value: "${defaultValue}"`);
      return defaultValue;
    }
  }
  return value;
}

module.exports = config;
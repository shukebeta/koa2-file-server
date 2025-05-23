const path = require('path');
const md5File = require('md5-file');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const fs = require('fs').promises;
const { createDirectory, moveFile, removeDir } = require('../lib/utils');

/**
 * Service for handling file processing and database operations related to file uploads.
 * This includes calculating file hashes, managing file storage, and updating database records.
 */
class FileService {
  constructor(config) {
    this.config = config;
    this.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.heic'];
    this.heicQuality = 0.7;
    this.thumbnailSize = 320;
  }

  /**
   * Generates a random hash directory path for file storage.
   * @returns {string} A directory path with random digits.
   */
  getHashDir() {
    const getRandInt = () => Math.floor(Math.random() * 10);
    return `/${getRandInt()}${getRandInt()}/${getRandInt()}${getRandInt()}/`;
  }

  /**
   * Cleans up temporary upload directories.
   * @param {Object} file - The file object containing destination path.
   */
  async cleanUploadDir(file) {
    try {
      await removeDir(file.destination);
      await removeDir(file.destination.replace(/\d+\/$/, ''));
    } catch (error) {
      throw new Error(`Failed to clean upload directory: ${error.message}`);
    }
  }

  /**
   * Calculates MD5 hash for a file.
   * @param {string} filePath - Path to the file.
   * @returns {string} MD5 hash of the file.
   */
  calculateFileHash(filePath) {
    return md5File.sync(filePath);
  }

  /**
   * Checks if a file extension indicates an image file.
   * @param {string} extension - File extension including the dot.
   * @returns {boolean} True if the file is an image.
   */
  isImageFile(extension) {
    return this.imageExtensions.includes(extension.toLowerCase());
  }

  /**
   * Gets current Unix timestamp.
   * @returns {number} Current timestamp in seconds.
   */
  getCurrentTimestamp() {
    return Math.round(Date.now() / 1000);
  }

  /**
   * Finds existing file record by MD5 hash.
   * @param {string} md5Hash - MD5 hash to search for.
   * @param {Object} db - Database context.
   * @returns {Promise<Object|null>} Existing file record or null.
   */
  async findExistingFile(md5Hash, db) {
    return await db.files.findOne({ where: { md5: md5Hash } });
  }

  /**
   * Updates reference count and metadata for existing file.
   * @param {Object} existingFile - Existing file record.
   * @param {Object} uploadedFile - New uploaded file data.
   * @param {Object} db - Database context.
   * @returns {Promise<Object>} Updated file record.
   */
  async updateExistingFile(existingFile, uploadedFile, db) {
    const timestamp = this.getCurrentTimestamp();
    
    await db.files.update({
      refCount: db.sequelize.literal('RefCount + 1'),
      updatedAt: timestamp,
      fileName: uploadedFile.originalname
    }, { where: { id: existingFile.id } });

    // Update local object to match database
    existingFile.refCount += 1;
    existingFile.updatedAt = timestamp;
    existingFile.fileName = uploadedFile.originalname;

    return existingFile;
  }

  /**
   * Converts HEIC file to JPEG format.
   * @param {string} inputPath - Path to HEIC file.
   * @returns {Promise<string>} Path to converted JPEG file.
   */
  async convertHeicToJpeg(inputPath) {
    try {
      const inputBuffer = await fs.readFile(inputPath);
      const outputBuffer = await heicConvert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: this.heicQuality
      });
      
      const jpegPath = inputPath + '.jpg';
      await fs.writeFile(jpegPath, outputBuffer);
      return jpegPath;
    } catch (error) {
      console.error('HEIC to JPEG conversion failed:', error);
      throw error;
    }
  }

  /**
   * Processes image file with rotation and format conversion.
   * @param {Object} file - File object from multer.
   * @param {string} outputPath - Destination path for processed file.
   * @param {string} targetExtension - Target file extension after processing.
   * @param {number} [maxNarrowSideOverride] - Optional override for max narrow side dimension.
   * @returns {Promise<void>}
   */
  async processImageFile(file, outputPath, targetExtension, maxNarrowSideOverride) {
    let sourcePath = file.path;
    let tempJpegPath = null;

    try {
      // Convert HEIC to JPEG if needed
      if (path.extname(file.filename || file.originalname).toLowerCase() === '.heic') {
        tempJpegPath = await this.convertHeicToJpeg(sourcePath);
        sourcePath = tempJpegPath;
      }

      let image = sharp(sourcePath);
      const metadata = await image.metadata();
      const { width, height } = metadata;

      const maxNarrowSide = maxNarrowSideOverride || this.config.maxImageNarrowSide;

      // Resize if the narrow side exceeds the maximum allowed dimension
      if (width && height && (Math.min(width, height) > maxNarrowSide)) {
        image = image.resize({
          width: width > height ? undefined : maxNarrowSide,
          height: height > width ? undefined : maxNarrowSide,
          withoutEnlargement: true // Ensures images are only shrunk, not enlarged
        });
      }

      // Apply rotation and save to final destination, preserving EXIF metadata
      await image.rotate().withMetadata().toFile(outputPath);

    } catch (error) {
      console.error('Image processing failed:', error);
      // Fallback: move original file without processing
      await moveFile(file.path, outputPath);
    } finally {
      // Clean up temporary JPEG file if created
      if (tempJpegPath) {
        try {
          await fs.unlink(tempJpegPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temporary JPEG file:', cleanupError);
        }
      }
    }
  }

  /**
   * Creates a new file record in the database.
   * @param {string} filePath - Relative file path for storage.
   * @param {string} md5Hash - MD5 hash of the file.
   * @param {string} fileExtension - File extension.
   * @param {string} originalName - Original filename.
   * @param {Object} db - Database context.
   * @returns {Promise<Object>} Created file record.
   */
  async createNewFileRecord(filePath, md5Hash, fileExtension, originalName, db) {
    const timestamp = this.getCurrentTimestamp();
    
    return await db.files.create({
      id: 0,
      path: filePath,
      md5: md5Hash,
      fileExt: fileExtension,
      refCount: 1,
      fileName: originalName,
      createdAt: timestamp,
      updatedAt: null
    });
  }

  /**
   * Processes a new file upload, handling storage and database creation.
   * @param {Object} file - File object from multer.
   * @param {string} md5Hash - MD5 hash of the file.
   * @param {Object} db - Database context.
   * @param {number} [maxNarrowSideOverride] - Optional override for max narrow side dimension.
   * @returns {Promise<Object>} Created file record.
   */
  async processNewFile(file, md5Hash, db, maxNarrowSideOverride) {
    const storagePath = this.getHashDir();
    let fileExtension = path.extname(file.filename || file.originalname);
    const destinationDir = path.join(this.config.destPath, storagePath);
    
    await createDirectory(destinationDir);
    
    if (this.isImageFile(fileExtension)) {
      // For images, determine final extension first (HEIC -> JPG conversion)
      if (fileExtension.toLowerCase() === '.heic') {
        fileExtension = '.jpg';
      }
      
      const fileName = `${md5Hash}${fileExtension}`;
      const fullOutputPath = path.join(destinationDir, fileName);
      
      // Process image files (rotation, format conversion, and resizing)
      await this.processImageFile(file, fullOutputPath, fileExtension, maxNarrowSideOverride);
    } else {
      // Handle non-image files
      const fileName = `${md5Hash}${fileExtension}`;
      const fullOutputPath = path.join(destinationDir, fileName);
      await moveFile(file.path, fullOutputPath);
    }

    return await this.createNewFileRecord(
      storagePath,
      md5Hash,
      fileExtension,
      file.originalname,
      db
    );
  }

  /**
   * Processes a single uploaded file.
   * @param {Object} file - File object from multer.
   * @param {Object} db - Database context.
   * @param {number} [maxNarrowSideOverride] - Optional override for max narrow side dimension.
   * @returns {Promise<Object>} Processed file record with URL.
   */
  async processSingleFile(file, db, maxNarrowSideOverride) {
    if (!file) {
      return null;
    }

    try {
      const md5Hash = this.calculateFileHash(file.path);
      let fileRecord = await this.findExistingFile(md5Hash, db);

      if (fileRecord) {
        // File already exists, update reference count
        await this.cleanUploadDir(file);
        fileRecord = await this.updateExistingFile(fileRecord, file, db);
      } else {
        // New file, process and store
        fileRecord = await this.processNewFile(file, md5Hash, db, maxNarrowSideOverride);
        await this.cleanUploadDir(file);
      }

      // Add URL to the response
      const fileData = fileRecord.toJSON();
      fileData.url = `${this.config.imgServer}/${this.thumbnailSize}${fileData.path}${fileData.md5}${fileData.fileExt}`;
      
      return fileData;
    } catch (error) {
      // Ensure cleanup happens even if processing fails
      try {
        await this.cleanUploadDir(file);
      } catch (cleanupError) {
        console.warn('Failed to cleanup after processing error:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Processes uploaded files, calculating MD5 hash, checking for duplicates,
   * and storing file metadata in the database.
   * @param {Object|Array} files - Single file or array of file objects from multer.
   * @param {Object} db - Database context for operations.
   * @param {number} [maxNarrowSideOverride] - Optional override for max narrow side dimension.
   * @returns {Promise<Array>} Array of processed file metadata with URLs.
   */
  async processFiles(files, db, maxNarrowSideOverride) {
    // Normalize input to array
    const fileArray = Array.isArray(files) ? files : [files];
    
    // Filter out null/undefined files
    const validFiles = fileArray.filter(file => file != null);
    
    if (validFiles.length === 0) {
      return [];
    }

    // Process each file and collect results
    const results = [];
    for (const file of validFiles) {
      const processedFile = await this.processSingleFile(file, db, maxNarrowSideOverride);
      if (processedFile) {
        results.push(processedFile);
      }
    }

    return results;
  }
}

module.exports = FileService;
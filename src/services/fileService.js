const path = require('path');
const md5File = require('md5-file');
const { createDirectory, moveFile, removeDir } = require('../lib/utils');

/**
 * Service for handling file processing and database operations related to file uploads.
 * This includes calculating file hashes, managing file storage, and updating database records.
 */
class FileService {
  constructor(config) {
    this.config = config;
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
   * Processes uploaded files, calculating MD5 hash, checking for duplicates,
   * and storing file metadata in the database.
   * @param {Object|Array} files - Single file or array of file objects from multer.
   * @param {Object} db - Database context for operations.
   * @returns {Promise<Array>} Array of processed file metadata with URLs.
   */
  async processFiles(files, db) {
    if (!Array.isArray(files)) {
      files = [files];
    }

    if (!files || !files.length || !files[0]) {
      return [];
    }

    let data = [];
    for (const file of files) {
      if (!file) continue;
      const md5 = md5File.sync(file.path);
      let fileExt = path.extname(file.filename || file.originalname);
      let image = await db.files.findOne({ where: { md5 } });
      const nowInUnixTimestamp = Math.round(Date.now() / 1000);

      if (image) {
        await this.cleanUploadDir(file);
        await db.files.update({
          refCount: db.sequelize.literal('RefCount + 1'),
          updatedAt: nowInUnixTimestamp,
          fileName: file.originalname
        }, { where: { id: image.id } });
        image.refCount += 1;
        image.updatedAt = nowInUnixTimestamp;
      } else {
        const filePath = this.getHashDir();
        const fileName = `${md5}${fileExt}`;
        const newPath = path.join(this.config.destPath, filePath);

        await createDirectory(newPath);
        await moveFile(file.path, path.join(newPath, fileName));
        await this.cleanUploadDir(file);

        image = await db.files.create({
          id: 0,
          path: filePath,
          md5,
          fileExt,
          refCount: 1,
          fileName: file.originalname,
          createdAt: nowInUnixTimestamp,
          updatedAt: null
        });
      }
      image = image.toJSON();
      image.url = `${this.config.imgServer}/320${image.path}${image.md5}${image.fileExt}`;
      data.push(image);
    }

    return data;
  }
}

module.exports = FileService;
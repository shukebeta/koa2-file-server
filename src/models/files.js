/**
 * Sequelize model definition for the 'Files' table, storing metadata for uploaded files.
 * 
 * Fields:
 * - id: Unique identifier for the file record (auto-incrementing primary key).
 * - md5: MD5 hash of the file content, used to identify duplicates (unique constraint).
 * - path: Storage path of the file on the server.
 * - fileName: Original name of the uploaded file.
 * - fileExt: File extension (e.g., '.png').
 * - refCount: Number of references to this file, used to manage deletion when no longer needed.
 * - createdAt: Timestamp when the file record was created (Unix timestamp in seconds).
 * - updatedAt: Timestamp when the file record was last updated (Unix timestamp in seconds).
 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('files', {
    id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'Id'
    },
    md5: {
      type: DataTypes.CHAR(32),
      allowNull: false,
      unique: true,
      field: 'Md5'
    },
    path: {
      type: DataTypes.CHAR(20),
      allowNull: false,
      field: 'Path'
    },
    fileName: {
      type: DataTypes.CHAR(128),
      allowNull: true,
      field: 'FileName'
    },
    fileExt: {
      type: DataTypes.CHAR(5),
      allowNull: false,
      field: 'FileExt'
    },
    refCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'RefCount'
    },
    createdAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'CreatedAt'
    },
    updatedAt: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'UpdatedAt'
    }
  }, {
    tableName: 'Files',
    timestamps: false
  });
};
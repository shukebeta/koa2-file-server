/* jshint indent: 1 */

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

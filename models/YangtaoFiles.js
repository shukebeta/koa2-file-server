/* jshint indent: 1 */

module.exports = function(sequelize, DataTypes) {
	return sequelize.define('yangtaoFiles', {
		id: {
			type: DataTypes.BIGINT,
			allowNull: false,
			primaryKey: true,
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
		fileExt: {
			type: DataTypes.CHAR(4),
			allowNull: false,
			field: 'FileExt'
		},
		refCount: {
			type: DataTypes.INTEGER,
			allowNull: true,
			field: 'RefCount'
		},
		createAt: {
			type: DataTypes.DATE,
			allowNull: true,
			field: 'CreateAt'
		},
		updateAt: {
			type: DataTypes.DATE,
			allowNull: true,
			field: 'UpdateAt'
		}
	}, {
		tableName: 'YangtaoFiles',
		timestamps: false
	});
};

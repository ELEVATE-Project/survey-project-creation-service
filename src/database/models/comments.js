'use strict'

module.exports = (sequelize, DataTypes) => {
	const Comment = sequelize.define(
		'Comment',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			resource_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			organization_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			tenant_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			comment: {
				allowNull: false,
				type: DataTypes.TEXT,
			},
			user_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			parent_id: {
				allowNull: false,
				defaultValue: 0,
				type: DataTypes.INTEGER,
			},
			status: {
				allowNull: false,
				type: DataTypes.ENUM('OPEN', 'RESOLVED', 'DRAFT'),
				defaultValue: 'DRAFT',
			},
			resolved_by: {
				type: DataTypes.STRING,
			},
			resolved_at: {
				type: DataTypes.DATE,
			},
			context: {
				allowNull: false,
				defaultValue: 'page',
				type: DataTypes.STRING,
			},
			page: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			is_read: {
				allowNull: false,
				defaultValue: false,
				type: DataTypes.BOOLEAN,
			},
		},
		{
			modelName: 'Comment',
			tableName: 'comments',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					unique: true,
					fields: ['id', 'resource_id', 'organization_code', 'tenant_code'],
					name: 'unique_comment_resource',
					where: {
						deleted_at: null,
					},
				},
			],
		}
	)

	return Comment
}

'use strict'
module.exports = (sequelize, DataTypes) => {
	const organizationExtension = sequelize.define(
		'organizationExtension',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			organization_code: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true,
			},
			tenant_code: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
			},
			resource_type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			review_required: {
				allowNull: false,
				type: DataTypes.BOOLEAN,
				defaultValue: true,
			},
			show_reviewer_list: {
				allowNull: false,
				defaultValue: true,
				type: DataTypes.BOOLEAN,
			},
			min_approval: {
				allowNull: false,
				defaultValue: 1,
				type: DataTypes.INTEGER,
			},
			review_type: {
				allowNull: false,
				type: DataTypes.ENUM('SEQUENTIAL', 'PARALLEL'),
				defaultValue: 'SEQUENTIAL',
			},
			review_required_after_publish: {
				allowNull: false,
				type: DataTypes.BOOLEAN,
				defaultValue: true,
			},
		},
		{
			sequelize,
			modelName: 'organizationExtension',
			tableName: 'organization_extensions',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					unique: true,
					fields: ['organization_code', 'resource_type', 'tenant_code'],
					name: 'unique_org_resource_type_tenant',
					where: {
						deleted_at: null,
					},
				},
			],
		}
	)

	return organizationExtension
}

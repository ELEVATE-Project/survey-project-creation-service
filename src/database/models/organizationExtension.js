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
			organization_id: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			resource_type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			review_required: {
				allowNull: false,
				type: DataTypes.BOOLEAN,
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
					fields: ['organization_id', 'resource_type'],
					name: 'unique_org_resource_type',
				},
			],
		}
	)

	return organizationExtension
}

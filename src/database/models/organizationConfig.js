'use strict'
module.exports = (sequelize, DataTypes) => {
	const organizationConfig = sequelize.define(
		'organizationConfig',
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
				primaryKey: true,
			},
			meta: {
				allowNull: true,
				type: DataTypes.JSONB,
			},
		},
		{
			sequelize,
			modelName: 'organizationConfig',
			tableName: 'organization_configs',
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

	return organizationConfig
}

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
			organization_code: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true,
			},
			tenant_code: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true,
			},
			meta: {
				allowNull: true,
				type: DataTypes.JSONB,
			},
			resource_visibility_policy: {
				type: DataTypes.ENUM('CURRENT', 'ASSOCIATED', 'ALL'),
				allowNull: false,
				defaultValue: 'CURRENT',
			},
			external_resource_visibility_policy: {
				type: DataTypes.ENUM('CURRENT', 'ASSOCIATED', 'ALL'),
				allowNull: false,
				defaultValue: 'CURRENT',
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
					fields: ['tenant_code', 'organization_code'],
					name: 'unique_org_tenant_config',
					where: {
						deleted_at: null,
					},
				},
			],
		}
	)

	return organizationConfig
}

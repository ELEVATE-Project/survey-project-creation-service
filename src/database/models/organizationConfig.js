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
					fields: ['organization_code', 'tenant_code'],
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

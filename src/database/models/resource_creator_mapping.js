'use strict'

module.exports = (sequelize, DataTypes) => {
	const ResourceCreatorMapping = sequelize.define(
		'ResourceCreatorMapping',
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
			creator_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
			},
			organization_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			tenant_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
		},
		{
			indexes: [
				{
					unique: true,
					fields: ['resource_id', 'creator_id', 'organization_code', 'tenant_code'],
					name: 'unique_creator_resource_org_tenant',
					where: {
						deleted_at: null,
					},
				},
			],
			modelName: 'ResourceCreatorMapping',
			tableName: 'resource_creator_mapping',
			freezeTableName: true,
			paranoid: true,
		}
	)

	// Define associations (foreign key constraints)
	ResourceCreatorMapping.associate = (models) => {
		ResourceCreatorMapping.belongsTo(models.Resource, {
			foreignKey: 'resource_id',
			targetKey: 'id',
			as: 'resource',
			onUpdate: 'NO ACTION',
			onDelete: 'CASCADE',
		})
	}

	return ResourceCreatorMapping
}

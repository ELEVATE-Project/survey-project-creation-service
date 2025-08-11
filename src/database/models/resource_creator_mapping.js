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
			created_at: {
				allowNull: false,
				type: DataTypes.DATE,
			},
			updated_at: {
				allowNull: false,
				type: DataTypes.DATE,
			},
			deleted_at: {
				type: DataTypes.DATE,
			},
		},
		{
			indexes: [
				{
					unique: true,
					fields: ['resource_id', 'creator_id', 'organization_code', 'tenant_code'],
					name: 'unique_creator_resource',
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

'use strict'
module.exports = (sequelize, DataTypes) => {
	const EntityModelMapping = sequelize.define(
		'EntityModelMapping',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			entity_type_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			model: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			organization_code: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			status: {
				type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
				allowNull: false,
				defaultValue: 'ACTIVE',
			},
			tenant_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
		},
		{
			sequelize,
			modelName: 'EntityModelMapping',
			tableName: 'entities_model_mapping',
			freezeTableName: true,
			paranoid: true,
		}
	)

	EntityModelMapping.associate = function (models) {
		EntityModelMapping.belongsTo(models.EntityType, {
			foreignKey: {
				name: 'entity_type_id',
				field: 'entity_type_id',
			},
			targetKey: 'id',
			as: 'EntityType',
			constraints: true,
			foreignKeyConstraint: true,
		})
	}

	return EntityModelMapping
}

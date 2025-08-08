'use strict'
module.exports = (sequelize, DataTypes) => {
	const Entity = sequelize.define(
		'Entity',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			entity_type_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				allowNull: false,
			},
			value: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			label: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			status: {
				type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
				allowNull: false,
				defaultValue: 'ACTIVE',
			},
			type: {
				type: DataTypes.STRING,
			},
			organization_code: {
				type: DataTypes.STRING,
				primaryKey: true,
				allowNull: false,
			},
			tenant_code: {
				type: DataTypes.STRING,
				primaryKey: true,
				allowNull: false,
			},
			created_by: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			updated_by: {
				type: DataTypes.STRING,
				allowNull: true,
			},
		},
		{ sequelize, modelName: 'Entity', tableName: 'entities', freezeTableName: true, paranoid: true }
	)

	Entity.associate = (models) => {
		Entity.belongsTo(models.EntityType, {
			foreignKey: 'entity_type_id',
			as: 'entity_type',
			targetKey: 'id',
			scope: {
				deleted_at: null, // Only associate with active EntityType records
			},
		})
	}

	return Entity
}

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
			tenant_code: {
				type: DataTypes.STRING,
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

	Entity.associate = function (models) {
		Entity.belongsTo(models.EntityType, {
			foreignKey: {
				name: 'entity_type_id',
				field: 'entity_type_id',
			},
			targetKey: 'id',
			as: 'entities',
			constraints: true,
			foreignKeyConstraint: true,
		})
	}

	return Entity
}

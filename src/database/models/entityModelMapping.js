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
			status: {
				type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
				allowNull: false,
				defaultValue: 'ACTIVE',
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

	return EntityModelMapping
}

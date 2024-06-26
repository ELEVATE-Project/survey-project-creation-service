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

	EntityModelMapping.addHook('beforeDestroy', async (instance, options) => {
		try {
			// Soft-delete only the associated Entity records with matching entity_model_mapping_id
			await sequelize.models.EntityModelMapping.update(
				{ deleted_at: new Date() }, // Set the deleted_at column to the current timestamp
				{
					where: {
						entity_model_mapping_id: instance.id, // instance.id contains the primary key of the EntityType record being deleted
					},
				}
			)
		} catch (error) {
			console.error('Error during beforeDestroy hook:', error)
			throw error
		}
	})

	return EntityModelMapping
}

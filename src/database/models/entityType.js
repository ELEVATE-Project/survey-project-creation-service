'use strict'
module.exports = (sequelize, DataTypes) => {
	const EntityType = sequelize.define(
		'EntityType',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
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
			allow_filtering: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			data_type: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'STRING',
			},
			organization_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				primaryKey: true,
			},
			parent_id: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			allow_custom_entities: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			has_entities: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			validations: {
				type: DataTypes.JSON,
			},
			created_by: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			updated_by: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
		},
		{ sequelize, modelName: 'EntityType', tableName: 'entity_types', freezeTableName: true, paranoid: true }
	)

	EntityType.addHook('beforeDestroy', async (instance, options) => {
		try {
			// Soft-delete only the associated Entity records with matching entity_type_id
			await sequelize.models.Entity.update(
				{ deleted_at: new Date() }, // Set the deleted_at column to the current timestamp
				{
					where: {
						entity_type_id: instance.id, // instance.id contains the primary key of the EntityType record being deleted
					},
				}
			)
		} catch (error) {
			console.error('Error during beforeDestroy hook:', error)
			throw error
		}
	})

	return EntityType
}

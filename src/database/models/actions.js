'use strict'
module.exports = (sequelize, DataTypes) => {
	const Action = sequelize.define(
		'Action',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			code: {
				allowNull: false,
				unique: true,
				type: DataTypes.STRING,
			},
			description: {
				type: DataTypes.STRING,
			},
			status: {
				allowNull: false,
				type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
				defaultValue: 'ACTIVE',
			},
		},
		{
			modelName: 'Action',
			tableName: 'actions',
			freezeTableName: true,
			paranoid: true,
		}
	)

	Action.addHook('beforeDestroy', async (instance, options) => {
		try {
			// Soft-delete associated Permissions records with matching module
			await sequelize.models.Activity.update(
				{ deleted_at: new Date() }, // Set the deleted_at column to the current timestamp
				{
					where: {
						action_id: instance.id, // instance.id contains the id of the Action record being deleted
					},
				}
			)
		} catch (error) {
			console.error('Error during beforeDestroy hook:', error)
			throw error
		}
	})

	return Action
}

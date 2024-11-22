'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add the `is_external` column to the `entity_types` table
		await queryInterface.addColumn('entity_types', 'is_external', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false, // Set a default value for existing rows
		})
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the `is_external` column from the `entity_types` table
		await queryInterface.removeColumn('entity_types', 'is_external')
	},
}

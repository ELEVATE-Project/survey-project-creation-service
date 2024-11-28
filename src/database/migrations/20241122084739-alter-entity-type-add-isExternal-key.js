'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add the `config` column to the `entity_types` table
		await queryInterface.addColumn('entity_types', 'config', {
			type: Sequelize.JSONB,
			allowNull: true,
			defaultValue: {}, // Set a default value for existing rows
		})
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the `config` column from the `entity_types` table
		await queryInterface.removeColumn('entity_types', 'config')
	},
}

'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add the `is_external` column to the `entity_types` table
		await queryInterface.addColumn('entity_types', 'is_external', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false, // Set a default value for existing rows
		})
		// Add the `is_external` column to the `entity_types` table
		await queryInterface.addColumn('entity_types', 'is_dependent', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false, // Set a default value for existing rows
		})
		// Add the `is_external` column to the `entity_types` table
		await queryInterface.addColumn('entity_types', 'depended_on', {
			allowNull: false,
			defaultValue: 0,
			type: Sequelize.INTEGER,
		})
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the `is_external` column from the `entity_types` table
		await queryInterface.removeColumn('entity_types', 'is_external')
		await queryInterface.removeColumn('entity_types', 'is_dependent')
		await queryInterface.removeColumn('entity_types', 'depended_on')
	},
}

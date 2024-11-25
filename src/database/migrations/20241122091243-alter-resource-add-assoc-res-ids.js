'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add the `associated_resource_ids` column to the `resources` table
		await queryInterface.addColumn('resources', 'associated_resource_ids', {
			type: Sequelize.ARRAY(Sequelize.INTEGER),
			allowNull: false,
			defaultValue: [],
		})
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the `associated_resource_ids` column from the `resources` table
		await queryInterface.removeColumn('resources', 'associated_resource_ids')
	},
}

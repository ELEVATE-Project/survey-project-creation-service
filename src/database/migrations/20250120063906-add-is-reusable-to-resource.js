'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('resources', 'is_reusable', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true, // Default value set to true
		})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn('resources', 'is_reusable')
	},
}

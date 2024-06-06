'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Adding a new column to the 'resources' table
		await queryInterface.addColumn('resources', 'title', {
			type: Sequelize.STRING,
			allowNull: true,
		})
		await queryInterface.addIndex('resources', ['title'])
	},

	async down(queryInterface, Sequelize) {
		// Removing the new column from the 'resources' table
		await queryInterface.removeColumn('resources', 'title')
	},
}

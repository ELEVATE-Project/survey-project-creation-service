'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		//add submitted_on and published_on
		await queryInterface.addColumn('resources', 'submitted_on', {
			type: Sequelize.DATE,
			allowNull: true,
		})

		await queryInterface.addColumn('resources', 'published_on', {
			type: Sequelize.DATE,
			allowNull: true,
		})

		// Rename column last_reviewed_at to last_reviewed_on
		await queryInterface.renameColumn('resources', 'last_reviewed_at', 'last_reviewed_on')
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('resources', 'submitted_on')
		await queryInterface.removeColumn('resources', 'published_on')
		await queryInterface.renameColumn('resources', 'last_reviewed_on', 'last_reviewed_at')
	},
}

'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		//add submitted_on and published_on
		await queryInterface.addColumn('resources', 'stage', {
			type: Sequelize.ENUM('CREATION', 'REVIEW', 'COMPLETION'),
			defaultValue: 'CREATION',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('resources', 'stage')
	},
}

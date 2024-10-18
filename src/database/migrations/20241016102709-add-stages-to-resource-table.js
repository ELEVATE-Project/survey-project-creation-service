'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		//add submitted_on and published_on
		await queryInterface.addColumn('resources', 'stage', {
			type: Sequelize.ENUM('CREATION', 'REVIEW', 'COMPLETION'),
			defaultValue: 'CREATION',
		})

		// Add index to the 'stage' column for performance improvement
		await queryInterface.addIndex('resources', ['stage'], {
			name: 'resources_stage_index',
		})
	},

	async down(queryInterface, Sequelize) {
		// Remove the index on 'stage' column
		await queryInterface.removeIndex('resources', 'resources_stage_index')

		await queryInterface.removeColumn('resources', 'stage')
	},
}

'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('resources', 'source_resource_id', {
			type: Sequelize.INTEGER,
			allowNull: true,
		})

		await queryInterface.addIndex('resources', ['source_resource_id'], {
			name: 'resources_source_resource_id_index',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeIndex('resources', 'resources_source_resource_id_index')
		await queryInterface.removeColumn('resources', 'source_resource_id')
	},
}

'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('organization_configs', 'project_resource_visibility_policy', {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: 'CURRENT',
		})

		await queryInterface.addColumn('organization_configs', 'external_project_resource_visibility_policy', {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: 'CURRENT',
		})
	},

	async down(queryInterface, Sequelize) {
		/**
		 * Add reverting commands here.
		 *
		 * Example:
		 * await queryInterface.dropTable('users');
		 */
		await queryInterface.removeColumn('organization_configs', 'project_resource_visibility_policy')
		await queryInterface.removeColumn('organization_configs', 'external_project_resource_visibility_policy')
	},
}

'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		/**
		 * Add altering commands here.
		 *
		 * Example:
		 * await queryInterface.createTable('resources', { id: Sequelize.INTEGER });
		 */

		await queryInterface.addColumn('resources', 'visibility', {
			type: Sequelize.ENUM('CURRENT', 'ASSOCIATED', 'ALL'),
			allowNull: false,
			defaultValue: 'CURRENT',
		})

		await queryInterface.addColumn('resources', 'visible_to_organizations', {
			type: Sequelize.ARRAY(Sequelize.STRING),
			allowNull: false,
			defaultValue: [],
		})
	},

	async down(queryInterface, Sequelize) {
		/**
		 * Add reverting commands here.
		 *
		 * Example:
		 * await queryInterface.dropTable('users');
		 */
		await queryInterface.sequelize.query(`
			  DROP TYPE IF EXISTS enum_resources_visibility;
			`)
		await queryInterface.removeColumn('resources', 'visible_to_organizations')
	},
}

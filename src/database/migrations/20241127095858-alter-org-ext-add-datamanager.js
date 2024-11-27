'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		//add submitted_on and published_on
		await queryInterface.addColumn('organization_extensions', 'data_manager_roles', {
			type: Sequelize.ARRAY(Sequelize.STRING),
			defaultValue: [],
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('organization_extensions', 'data_manager_roles')
	},
}

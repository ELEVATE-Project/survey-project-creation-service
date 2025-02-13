'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('organization_extensions', 'review_required_after_publish', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('organization_extensions', 'review_required_after_publish')
	},
}

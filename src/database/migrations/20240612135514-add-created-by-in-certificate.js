'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Adding a new columns to the 'certificate_base_templates' table
		await queryInterface.addColumn('certificate_base_templates', 'created_by', {
			type: Sequelize.INTEGER,
			allowNull: true,
		})

		await queryInterface.addColumn('certificate_base_templates', 'updated_by', {
			type: Sequelize.INTEGER,
			allowNull: true,
		})
	},

	async down(queryInterface, Sequelize) {
		// Removing the new columns from the 'certificate_base_templates' table
		await queryInterface.removeColumn('certificate_base_templates', 'created_by')
		await queryInterface.removeColumn('certificate_base_templates', 'updated_by')
	},
}

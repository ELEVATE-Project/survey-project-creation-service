'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		//to get to know the is user started editing when the resource status is in_review
		await queryInterface.addColumn('resources', 'is_resume_edit', {
			type: Sequelize.BOOLEAN,
			allowNull: true,
			defaultValue: false,
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('resources', 'is_resume_edit')
	},
}

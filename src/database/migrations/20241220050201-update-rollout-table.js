'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.changeColumn('rollouts', 'start_date', {
			allowNull: true,
			type: Sequelize.DATE,
		})
		await queryInterface.changeColumn('rollouts', 'end_date', {
			allowNull: true,
			type: Sequelize.DATE,
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.changeColumn('rollouts', 'start_date', {
			allowNull: false,
			type: Sequelize.DATE,
		})
		await queryInterface.changeColumn('rollouts', 'end_date', {
			allowNull: false,
			type: Sequelize.DATE,
		})
	},
}

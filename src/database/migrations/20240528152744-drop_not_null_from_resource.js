'use strict'
/** @type {import('sequelize-cli').Migration} */

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn('resources', 'blob_path', {
			type: Sequelize.STRING,
			allowNull: true,
		})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn('resources', 'blob_path', {
			type: Sequelize.STRING,
			allowNull: false,
		})
	},
}

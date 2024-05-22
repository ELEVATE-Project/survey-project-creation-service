'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('forms', {
			id: {
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
				type: Sequelize.INTEGER,
			},
			type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			sub_type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			data: Sequelize.JSON,
			version: {
				allowNull: false,
				defaultValue: 0,
				type: Sequelize.INTEGER,
			},
			created_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			updated_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			deleted_at: {
				type: Sequelize.DATE,
			},
			organization_id: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('forms')
	},
}

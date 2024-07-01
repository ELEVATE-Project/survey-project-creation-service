'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('review_stages', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			role: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			level: {
				allowNull: false,
				defaultValue: 1,
				type: Sequelize.INTEGER,
			},
			resource_type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			organization_id: {
				allowNull: false,
				type: Sequelize.STRING,
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
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('review_stages')
	},
}

'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('review_resources', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			resource_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			reviewer_id: {
				type: Sequelize.STRING,
				allowNull: false,
				primaryKey: true,
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
		await queryInterface.dropTable('review_resources')
	},
}

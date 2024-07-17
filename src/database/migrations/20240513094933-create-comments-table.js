'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('comments', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			resource_id: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			comment: {
				allowNull: false,
				type: Sequelize.TEXT,
			},
			user_id: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			parent_id: {
				allowNull: false,
				defaultValue: 0,
				type: Sequelize.INTEGER,
			},
			status: {
				allowNull: false,
				type: Sequelize.ENUM('OPEN', 'RESOLVED', 'DRAFT'),
				defaultValue: 'DRAFT',
			},
			resolved_by: {
				type: Sequelize.STRING,
			},
			resolved_at: {
				type: Sequelize.DATE,
			},
			context: {
				allowNull: false,
				defaultValue: 'page',
				type: Sequelize.STRING,
			},
			page: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			is_read: {
				allowNull: false,
				defaultValue: false,
				type: Sequelize.BOOLEAN,
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
		await queryInterface.dropTable('comments')
	},
}

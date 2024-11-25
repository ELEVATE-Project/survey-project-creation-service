'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('rollouts', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			resource_type: {
				allowNull: false,
				unique: true,
				type: Sequelize.STRING,
			},
			resource_id: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			status: {
				allowNull: false,
				type: Sequelize.ENUM('PENDING', 'ROLLED_OUT', 'INACTIVE'),
				defaultValue: 'PENDING',
			},
			rollout_date: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			organization_id: {
				primaryKey: true,
				allowNull: false,
				type: Sequelize.STRING,
			},
			user_id: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			start_date: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			end_date: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			published_id: {
				type: Sequelize.STRING,
			},
			title: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			blob_path: {
				allowNull: true,
				type: Sequelize.STRING,
			},
			parent_id: {
				allowNull: false,
				defaultValue: 0,
				type: Sequelize.INTEGER,
			},
			type: {
				allowNull: false,
				type: Sequelize.ENUM('PROGRAM', 'SOLUTION'),
				type: Sequelize.STRING,
			},
			duplicate_template_id: {
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
		await queryInterface.dropTable('rollouts')
	},
}

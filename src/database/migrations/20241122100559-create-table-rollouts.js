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
				type: Sequelize.STRING,
			},
			resource_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
			},
			status: {
				allowNull: false,
				type: Sequelize.ENUM('PENDING', 'ROLLED_OUT', 'INACTIVE'),
				defaultValue: 'PENDING',
			},
			published_on: {
				allowNull: true,
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
				type: Sequelize.ENUM('program', 'solution'),
				defaultValue: 'program',
			},
			template_id: {
				type: Sequelize.STRING,
			},
			created_by: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			updated_by: {
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

		await queryInterface.addIndex('rollouts', ['status'], {
			name: 'rollouts_status_index',
		})
		await queryInterface.addIndex('rollouts', ['user_id'], {
			name: 'rollouts_user_id_index',
		})
		await queryInterface.addIndex('rollouts', ['title'], {
			name: 'rollouts_title_index',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('rollouts')
	},
}

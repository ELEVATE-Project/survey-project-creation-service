'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('resources', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			status: {
				allowNull: false,
				type: Sequelize.ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'),
				defaultValue: 'DRAFT',
			},
			blob_path: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			user_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
			},
			organization_id: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			published_id: {
				type: Sequelize.STRING,
			},
			next_stage: {
				type: Sequelize.INTEGER,
			},
			review_type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			reference_id: {
				type: Sequelize.INTEGER,
			},
			meta: {
				allowNull: false,
				type: Sequelize.JSONB,
			},
			created_by: {
				type: Sequelize.INTEGER,
			},
			updated_by: {
				type: Sequelize.INTEGER,
			},
			deleted_at: {
				type: Sequelize.DATE,
			},
			created_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			updated_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('resources')
	},
}

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
			title: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			status: {
				allowNull: false,
				type: Sequelize.ENUM(
					'DRAFT',
					'SUBMITTED',
					'IN_REVIEW',
					'APPROVED',
					'REJECTED',
					'PUBLISHED',
					'REJECTED_AND_REPORTED'
				),
				defaultValue: 'DRAFT',
			},
			blob_path: {
				allowNull: true,
				type: Sequelize.STRING,
			},
			user_id: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			organization_id: {
				primaryKey: true,
				allowNull: false,
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
			published_id: {
				type: Sequelize.STRING,
			},
			meta: {
				allowNull: true,
				type: Sequelize.JSONB,
			},
			created_by: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			updated_by: {
				type: Sequelize.STRING,
			},
			last_reviewed_at: {
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
			deleted_at: {
				type: Sequelize.DATE,
			},
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('resources')
	},
}

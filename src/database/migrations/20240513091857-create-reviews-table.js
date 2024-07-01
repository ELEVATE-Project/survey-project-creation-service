'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('reviews', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			resource_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
			},
			reviewer_id: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			status: {
				type: Sequelize.ENUM(
					'NOT_STARTED',
					'STARTED',
					'INPROGRESS',
					'REQUESTED_FOR_CHANGES',
					'APPROVED',
					'REJECTED',
					'PUBLISHED',
					'REJECTED_AND_REPORTED'
				),
				defaultValue: 'NOT_STARTED',
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

		// Add an index for the 'value' column
		await queryInterface.addIndex('reviews', ['resource_id', 'reviewer_id'], {
			unique: true,
			name: 'unique_resource_reviewer',
			where: {
				deleted_at: null,
			},
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('reviews')
	},
}

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
					'REJECTED_AND_REPORTED',
					'CHANGES_UPDATED'
				),
				defaultValue: 'NOT_STARTED',
			},
			organization_code: {
				primaryKey: true,
				allowNull: false,
				type: Sequelize.STRING,
			},
			tenant_code: {
				primaryKey: true,
				allowNull: false,
				type: Sequelize.STRING,
			},
			notes: {
				allowNull: true,
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
		await queryInterface.addIndex('reviews', ['resource_id', 'reviewer_id', 'organization_code', 'tenant_code'], {
			unique: true,
			name: 'unique_resource_reviewer',
			where: {
				deleted_at: null,
			},
		})

		// Add foreign key constraint for resource_id, organization_code, and tenant_code
		await queryInterface.addConstraint('reviews', {
			fields: ['resource_id', 'organization_code', 'tenant_code'],
			type: 'foreign key',
			name: 'fk_reviews_resources',
			references: {
				table: 'resources',
				fields: ['id', 'organization_code', 'tenant_code'],
			},
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('reviews')
	},
}

'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('organization_extensions', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			organization_code: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			tenant_code: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			resource_type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			review_required: {
				allowNull: false,
				type: Sequelize.BOOLEAN,
			},
			review_required_after_publish: {
				allowNull: false,
				defaultValue: true,
				type: Sequelize.BOOLEAN,
			},
			show_reviewer_list: {
				allowNull: false,
				defaultValue: true,
				type: Sequelize.BOOLEAN,
			},
			min_approval: {
				allowNull: false,
				defaultValue: 1,
				type: Sequelize.INTEGER,
			},
			review_type: {
				allowNull: false,
				type: Sequelize.ENUM('SEQUENTIAL', 'PARALLEL'),
				defaultValue: 'SEQUENTIAL',
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
		// Add a unique index on the combination of organization_code and resource_type
		await queryInterface.addIndex(
			'organization_extensions',
			['organization_code', 'resource_type', 'tenant_code'],
			{
				unique: true,
				name: 'unique_org_resource_type_tenant',
				where: {
					deleted_at: null,
				},
			}
		)
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('organization_extensions')
	},
}

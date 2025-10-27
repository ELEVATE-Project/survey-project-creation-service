'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('certificate_base_templates', {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
			},
			code: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			url: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			resource_type: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			organization_code: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			tenant_code: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			meta: {
				type: Sequelize.JSON,
			},
			created_by: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			updated_by: {
				type: Sequelize.STRING,
				allowNull: true,
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
		// Add unique constraint for code per organization
		await queryInterface.addConstraint('certificate_base_templates', {
			type: 'unique',
			fields: ['organization_code', 'code', 'tenant_code'],
			name: 'unique_code_per_organization_tenant',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('certificate_base_templates')
	},
}

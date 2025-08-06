'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Add unique constraint for code per organization
		await queryInterface.addConstraint('certificate_base_templates', {
			type: 'unique',
			fields: ['organization_code', 'code', 'tenant_code'],
			name: 'unique_code_per_organization_tenant',
		})
	},

	async down(queryInterface, Sequelize) {
		// Remove unique constraint for code per organization
		await queryInterface.removeConstraint('certificate_base_templates', 'unique_code_per_organization_tenant')
	},
}

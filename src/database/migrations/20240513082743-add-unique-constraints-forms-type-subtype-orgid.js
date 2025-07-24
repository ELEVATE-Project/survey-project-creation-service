'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addConstraint('forms', {
			fields: ['type', 'sub_type', 'organization_id', 'tenant_code'],
			type: 'unique',
			name: 'unique_type_sub_type_org_id_tenant_code',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeConstraint('forms', 'unique_type_sub_type_org_id')
	},
}

'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
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

	down: async (queryInterface, Sequelize) => {
		// Remove the unique index
		await queryInterface.removeIndex('organization_extensions', 'unique_org_resource_type_tenant')
	},
}

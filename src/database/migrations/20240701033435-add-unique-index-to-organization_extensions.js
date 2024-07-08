'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add a unique index on the combination of organization_id and resource_type
		await queryInterface.addIndex('organization_extensions', ['organization_id', 'resource_type'], {
			unique: true,
			name: 'unique_org_resource_type',
		})
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the unique index
		await queryInterface.removeIndex('organization_extensions', 'unique_org_resource_type')
	},
}

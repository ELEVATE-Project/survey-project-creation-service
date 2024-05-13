'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Add unique constraint for resource_type per organization extension
		await queryInterface.addConstraint('organization_extensions', {
			type: 'unique',
			fields: ['organization_id', 'resource_type'],
			name: 'unique_resource_type_per_organization',
		})
	},

	async down(queryInterface, Sequelize) {
		// Remove unique constraint for resource_type per organization extension
		await queryInterface.removeConstraint('organization_extensions', 'unique_resource_type_per_organization')
	},
}

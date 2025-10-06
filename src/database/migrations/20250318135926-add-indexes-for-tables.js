'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Add an index to the 'resource_type' column in the 'certificate_base_templates' table
		await queryInterface.addIndex('certificate_base_templates', ['resource_type'], {
			name: 'certificate_resource_type_index',
		})

		// Add an index to the 'name' column in the 'certificate_base_templates' table
		await queryInterface.addIndex('certificate_base_templates', ['name'], {
			name: 'certificate_name_index',
		})

		// Add an index to the 'status' column in the 'comments' table
		await queryInterface.addIndex('comments', ['status'], {
			name: 'comments_status_index',
		})
	},

	async down(queryInterface, Sequelize) {
		// Remove an index to the 'resource_type' column in the 'certificate_base_templates' table
		await queryInterface.removeIndex('certificate_base_templates', 'certificate_resource_type_index')

		// Remove an index to the 'resource_type' column in the 'certificate_base_templates' table
		await queryInterface.removeIndex('certificate_base_templates', 'certificate_name_index')

		// Remove an index to the 'status' column in the 'comments' table
		await queryInterface.removeIndex('comments', 'comments_status_index')
	},
}

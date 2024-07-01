'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add a unique index on the combination of resource_id and creator_id
		await queryInterface.addIndex('resource_creator_mapping', ['resource_id', 'creator_id'], {
			unique: true,
			name: 'unique_creator_resource',
		})
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the unique index
		await queryInterface.removeIndex('resource_creator_mapping', 'unique_creator_resource')
	},
}

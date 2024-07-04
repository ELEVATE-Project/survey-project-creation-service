'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Remove the existing primary key constraint on the 'resource_id' column
		try {
			// Attempt to remove the existing primary key constraint if it exists
			await queryInterface.removeConstraint('resources', 'resources_pkey')
		} catch (error) {
			console.log('Constraint resources_pkey does not exist, skipping removal.')
		}

		// Add the new primary key constraint on the 'id' column
		await queryInterface.addConstraint('resources', {
			fields: ['id'],
			type: 'primary key',
			name: 'resources_id_pkey',
		})
	},

	down: async (queryInterface, Sequelize) => {
		// Remove the primary key constraint on the 'id' column
		await queryInterface.removeConstraint('resources', 'resources_id_pkey')

		// Add back the original primary key constraint on the 'resource_id' column
		await queryInterface.addConstraint('resources', {
			fields: ['resource_id'],
			type: 'primary key',
			name: 'resources_pkey',
		})
	},
}

'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Add new values to the ENUM type
		await queryInterface.sequelize.query(`
      ALTER TYPE "enum_resources_status"
      ADD VALUE IF NOT EXISTS 'REJECTED_AND_REPORTED';
    `)

		await queryInterface.sequelize.query(`
      ALTER TYPE "enum_resources_status"
      ADD VALUE IF NOT EXISTS 'REQUESTED_FOR_CHANGES';
    `)
	},

	down: async (queryInterface, Sequelize) => {
		// Unfortunately, you cannot remove a value from an ENUM type in PostgreSQL
		// So the down migration would typically involve more complex steps to recreate the ENUM type without the new values
	},
}

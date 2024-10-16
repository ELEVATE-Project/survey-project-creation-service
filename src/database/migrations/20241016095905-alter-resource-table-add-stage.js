'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Add new column 'stage' to 'resource' table with ENUM data type
		await queryInterface.addColumn('resource', 'stage', {
			type: Sequelize.ENUM('CREATION', 'REVIEW', 'COMPLETION'),
			allowNull: true, // Can be updated based on status
		})

		// Update 'stage' column based on the value of 'status'
		await queryInterface.sequelize.query(`
      UPDATE resource
      SET stage = CASE 
        WHEN status = 'DRAFT' THEN 'CREATION'
        WHEN status IN ('SUBMITTED','IN_REVIEW', 'REQUESTED_FOR_CHANGES', 'CHANGES_UPDATED', 'APPROVE') THEN 'REVIEW'
        WHEN status IN ('PUBLISHED', 'REJECTED', 'REJECTED_AND_REPORTED') THEN 'COMPLETION'
        ELSE NULL
      END
    `)
	},

	async down(queryInterface, Sequelize) {
		// Remove the 'stage' column from 'resource' table
		await queryInterface.removeColumn('resource', 'stage')

		// Drop the ENUM type for 'stage' as it's no longer needed
		await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_resource_stage";')
	},
}

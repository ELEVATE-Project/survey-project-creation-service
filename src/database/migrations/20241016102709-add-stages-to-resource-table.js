'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		//add submitted_on and published_on
		await queryInterface.addColumn('resources', 'stage', {
			type: Sequelize.ENUM('CREATION', 'REVIEW', 'COMPLETION'),
			defaultValue: 'CREATION',
		})

		// Add index to the 'stage' column for performance improvement
		await queryInterface.addIndex('resources', ['stage'], {
			name: 'resources_stage_index',
		})

		await queryInterface.sequelize.query(`
			ALTER TYPE "enum_resources_status" ADD VALUE 'NOT_STARTED';
			ALTER TYPE "enum_resources_status" ADD VALUE 'IN_PROGRESS';
			ALTER TYPE "enum_resources_status" ADD VALUE 'REQUESTED_FOR_CHANGES';
		`)
	},

	async down(queryInterface, Sequelize) {
		// Remove the index on 'stage' column
		await queryInterface.removeIndex('resources', 'resources_stage_index')

		await queryInterface.removeColumn('resources', 'stage')

		await queryInterface.sequelize.query(`
			CREATE TYPE "enum_resources_status_new" AS ENUM (
				'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'REJECTED_AND_REPORTED'
			);

			ALTER TABLE "resources" ALTER COLUMN "status" TYPE "enum_resources_status_new"
			USING "status"::text::"enum_resources_status_new";

			DROP TYPE "enum_resources_status";

			ALTER TYPE "enum_resources_status_new" RENAME TO "enum_resources_status";
		`)
	},
}

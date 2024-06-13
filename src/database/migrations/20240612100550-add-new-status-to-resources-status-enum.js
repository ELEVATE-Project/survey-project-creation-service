'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			// Step 1: Create a new ENUM type with the new values
			await queryInterface.sequelize.query(
				`
        CREATE TYPE "enum_resources_status_new" AS ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'REJECTED_AND_REPORTED', 'REQUESTED_FOR_CHANGES');
      `,
				{ transaction }
			)

			// Step 2: Remove the default value temporarily
			await queryInterface.sequelize.query(
				`
        ALTER TABLE "resources" ALTER COLUMN "status" DROP DEFAULT;
      `,
				{ transaction }
			)

			// Step 3: Update the column to use the new ENUM type
			await queryInterface.sequelize.query(
				`
        ALTER TABLE "resources" ALTER COLUMN "status" TYPE "enum_resources_status_new" USING ("status"::text::"enum_resources_status_new");
      `,
				{ transaction }
			)

			// Step 4: Restore the default value
			await queryInterface.sequelize.query(
				`
        ALTER TABLE "resources" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
      `,
				{ transaction }
			)

			// Step 5: Drop the old ENUM type
			await queryInterface.sequelize.query(
				`
        DROP TYPE "enum_resources_status";
      `,
				{ transaction }
			)

			// Step 6: Rename the new ENUM type to the old ENUM type name
			await queryInterface.sequelize.query(
				`
        ALTER TYPE "enum_resources_status_new" RENAME TO "enum_resources_status";
      `,
				{ transaction }
			)

			// Update the 'blob_path' column to make it nullable
			await queryInterface.changeColumn(
				'resources',
				'blob_path',
				{
					type: Sequelize.STRING,
					allowNull: true,
				},
				{ transaction }
			)

			await transaction.commit()
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	},

	async down(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			// Step 1: Create the original ENUM type without the new values
			await queryInterface.sequelize.query(
				`
        CREATE TYPE "enum_resources_status_old" AS ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');
      `,
				{ transaction }
			)

			// Step 2: Remove the default value temporarily
			await queryInterface.sequelize.query(
				`
        ALTER TABLE "resources" ALTER COLUMN "status" DROP DEFAULT;
      `,
				{ transaction }
			)

			// Step 3: Update the column to use the old ENUM type
			await queryInterface.sequelize.query(
				`
        ALTER TABLE "resources" ALTER COLUMN "status" TYPE "enum_resources_status_old" USING ("status"::text::"enum_resources_status_old");
      `,
				{ transaction }
			)

			// Step 4: Restore the default value
			await queryInterface.sequelize.query(
				`
        ALTER TABLE "resources" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
      `,
				{ transaction }
			)

			// Step 5: Drop the new ENUM type
			await queryInterface.sequelize.query(
				`
        DROP TYPE "enum_resources_status";
      `,
				{ transaction }
			)

			// Step 6: Rename the old ENUM type back to the original name
			await queryInterface.sequelize.query(
				`
        ALTER TYPE "enum_resources_status_old" RENAME TO "enum_resources_status";
      `,
				{ transaction }
			)

			await transaction.commit()
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	},
}

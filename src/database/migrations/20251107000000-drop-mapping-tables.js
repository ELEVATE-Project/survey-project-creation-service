'use strict'

/**
 * Migration: Drop resource_creator_mapping and review_resources tables
 *
 * This migration removes two mapping tables that are no longer needed in the multi-tenant architecture:
 * 1. resource_creator_mapping - Redundant with resources.user_id and resources.created_by fields
 * 2. review_resources - Redundant with reviews table which already tracks resource-reviewer relationships
 *
 * Key Features:
 * - Citus compatible (works with or without Citus enabled)
 * - Idempotent (can be run multiple times safely)
 * - Handles missing tables gracefully (for fresh setups)
 * - Safely removes all constraints before dropping tables
 * - Undistributes tables if Citus is enabled before dropping
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()

		try {
			console.log('Starting migration to drop mapping tables...')

			// Helper function to check if a table exists
			const tableExists = async (tableName) => {
				try {
					const result = await queryInterface.sequelize.query(
						`SELECT EXISTS (
							SELECT FROM information_schema.tables 
							WHERE table_schema = 'public' 
							AND table_name = '${tableName}'
						);`,
						{
							type: Sequelize.QueryTypes.SELECT,
							transaction,
						}
					)
					return result[0].exists
				} catch (error) {
					console.log(`Warning: Could not check if table ${tableName} exists:`, error.message)
					return false
				}
			}

			// Helper function to check if Citus is enabled
			const isCitusEnabled = async () => {
				try {
					const result = await queryInterface.sequelize.query(
						`SELECT EXISTS (
							SELECT 1 FROM pg_extension WHERE extname = 'citus'
						);`,
						{
							type: Sequelize.QueryTypes.SELECT,
							transaction,
						}
					)
					return result[0].exists
				} catch (error) {
					console.log('Citus extension check failed, assuming not enabled:', error.message)
					return false
				}
			}

			// Helper function to check if a table is distributed in Citus
			const isDistributed = async (tableName) => {
				try {
					const result = await queryInterface.sequelize.query(
						`SELECT COUNT(*) > 0 as is_distributed 
						FROM citus_tables 
						WHERE table_name::text = '${tableName}';`,
						{
							type: Sequelize.QueryTypes.SELECT,
							transaction,
						}
					)
					return result[0].is_distributed
				} catch (error) {
					console.log(`Table ${tableName} is not distributed or Citus not available`)
					return false
				}
			}

			// Helper function to safely remove constraint
			const removeConstraintIfExists = async (tableName, constraintName) => {
				try {
					// Check if constraint exists
					const constraintCheck = await queryInterface.sequelize.query(
						`SELECT COUNT(*) as count 
						FROM information_schema.table_constraints 
						WHERE table_name = '${tableName}' 
						AND constraint_name = '${constraintName}';`,
						{
							type: Sequelize.QueryTypes.SELECT,
							transaction,
						}
					)

					if (constraintCheck[0].count > 0) {
						await queryInterface.removeConstraint(tableName, constraintName, { transaction })
						console.log(`  ✓ Removed constraint: ${constraintName} from ${tableName}`)
					} else {
						console.log(`  ⊘ Constraint ${constraintName} does not exist on ${tableName}`)
					}
				} catch (error) {
					console.log(`  ⚠ Warning: Could not remove constraint ${constraintName}:`, error.message)
					// Continue execution - constraint might not exist
				}
			}

			// Helper function to safely remove index
			const removeIndexIfExists = async (tableName, indexName) => {
				try {
					// Check if index exists
					const indexCheck = await queryInterface.sequelize.query(
						`SELECT COUNT(*) as count 
						FROM pg_indexes 
						WHERE tablename = '${tableName}' 
						AND indexname = '${indexName}';`,
						{
							type: Sequelize.QueryTypes.SELECT,
							transaction,
						}
					)

					if (indexCheck[0].count > 0) {
						await queryInterface.removeIndex(tableName, indexName, { transaction })
						console.log(`  ✓ Removed index: ${indexName} from ${tableName}`)
					} else {
						console.log(`  ⊘ Index ${indexName} does not exist on ${tableName}`)
					}
				} catch (error) {
					console.log(`  ⚠ Warning: Could not remove index ${indexName}:`, error.message)
					// Continue execution - index might not exist
				}
			}

			// Helper function to undistribute a Citus table
			const undistributeTable = async (tableName) => {
				try {
					await queryInterface.sequelize.query(`SELECT undistribute_table('${tableName}');`, {
						transaction,
					})
					console.log(`  ✓ Undistributed Citus table: ${tableName}`)
				} catch (error) {
					console.log(`  ⚠ Warning: Could not undistribute ${tableName}:`, error.message)
					// Continue execution - table might not be distributed
				}
			}

			// Helper function to safely drop a table
			const dropTableSafely = async (tableName, constraints = [], indexes = []) => {
				console.log(`\nProcessing table: ${tableName}`)

				const exists = await tableExists(tableName)
				if (!exists) {
					console.log(`  ⊘ Table ${tableName} does not exist - skipping`)
					return
				}

				console.log(`  ✓ Table ${tableName} exists`)

				// Check if Citus is enabled
				const citusEnabled = await isCitusEnabled()
				if (citusEnabled) {
					console.log('  ℹ Citus is enabled')
					const distributed = await isDistributed(tableName)
					if (distributed) {
						console.log(`  ℹ Table ${tableName} is distributed`)
						await undistributeTable(tableName)
					}
				}

				// Remove foreign key constraints
				for (const constraint of constraints) {
					await removeConstraintIfExists(tableName, constraint)
				}

				// Remove indexes
				for (const index of indexes) {
					await removeIndexIfExists(tableName, index)
				}

				// Drop the table
				try {
					await queryInterface.dropTable(tableName, { transaction, cascade: true })
					console.log(`  ✓ Dropped table: ${tableName}`)
				} catch (error) {
					console.error(`  ✗ Failed to drop table ${tableName}:`, error.message)
					throw error
				}
			}

			// ============================================
			// DROP: resource_creator_mapping
			// ============================================
			await dropTableSafely(
				'resource_creator_mapping',
				[
					'pk_resource_creator_mapping', // Primary key constraint
					'fk_resource_creator_mapping_resource_id_org_code_tenant_code', // Foreign key to resources
				],
				[
					'unique_creator_resource_org_tenant', // Unique index
				]
			)

			// ============================================
			// DROP: review_resources
			// ============================================
			await dropTableSafely(
				'review_resources',
				[
					'fk_reviews_resources', // Foreign key to resources
				],
				[
					'unique_resource_reviewer_tenant_code', // Unique index
				]
			)

			await transaction.commit()
			console.log('\n✅ Migration completed successfully!')
			console.log('Summary:')
			console.log('  - resource_creator_mapping: Removed (redundant with resources.user_id)')
			console.log('  - review_resources: Removed (redundant with reviews table)')
		} catch (error) {
			await transaction.rollback()
			console.error('\n❌ Migration failed:', error.message)
			console.error('Full error:', error)
			throw error
		}
	},

	async down(queryInterface, Sequelize) {},
}

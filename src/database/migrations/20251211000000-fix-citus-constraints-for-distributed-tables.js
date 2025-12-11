'use strict'

/**
 * Migration: Fix Citus Distributed Table Constraints and Foreign Keys
 *
 * Purpose: Prepares all tables for Citus distribution by:
 * 1. Ensuring unique constraints include the partition column as the FIRST field
 * 2. Fixing foreign keys to use NO ACTION on UPDATE (CASCADE not supported)
 *
 * Fixes the following Citus errors:
 * - "cannot create constraint on table - constraints must include partition column"
 * - "referenced table must be a distributed table or reference table"
 * - "SET NULL, SET DEFAULT or CASCADE is not supported in ON UPDATE operation"
 * - "cannot create foreign key constraint since relations are not colocated"
 *
 * Tables fixed (with their partition columns):
 * - certificate_base_templates (tenant_code)
 * - comments (tenant_code - changed from resource_id to colocate with resources) + FK fix
 * - program_resource_mapping (tenant_code)
 * - reviews (tenant_code) + FK fix
 * - rollouts (tenant_code) + FK fix
 * - forms (tenant_code)
 * - organization_extensions (tenant_code)
 * - organization_configs (tenant_code)
 *
 * IMPORTANT: comments table is now distributed by tenant_code (not resource_id)
 * to enable foreign key constraint with resources table (both colocated by tenant_code).
 * Queries should always include tenant_code in WHERE clause for optimal performance.
 *
 * Run this migration BEFORE running distributionColumns.psql
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		console.log('=========================================')
		console.log('Fixing all Citus distribution constraints')
		console.log('=========================================')
		console.log('')
		console.log('For Citus distributed tables, ALL unique/primary key constraints')
		console.log('must include the partition column as the FIRST field.')
		console.log('')

		// 1. Fix certificate_base_templates (partition: tenant_code)
		console.log('1. Fixing certificate_base_templates...')
		try {
			// Remove the unique index first (if exists)
			try {
				await queryInterface.removeIndex('certificate_base_templates', 'unique_code_per_organization_tenant')
				console.log('   Removed old index')
			} catch (e) {
				console.log('   Note: unique_code_per_organization_tenant index not found')
			}

			// Remove the unique constraint if it exists as a constraint
			try {
				await queryInterface.removeConstraint(
					'certificate_base_templates',
					'unique_code_per_organization_tenant'
				)
				console.log('   Removed old constraint')
			} catch (e) {
				console.log('   Note: unique_code_per_organization_tenant constraint not found')
			}

			// Drop the existing primary key that only has 'id'
			await queryInterface.sequelize.query(
				'ALTER TABLE certificate_base_templates DROP CONSTRAINT IF EXISTS certificate_base_templates_pkey CASCADE;'
			)
			console.log('   Dropped old primary key')

			// Add new composite primary key with tenant_code first
			await queryInterface.sequelize.query(
				'ALTER TABLE certificate_base_templates ADD PRIMARY KEY (tenant_code, organization_code, id);'
			)
			console.log('   Added new composite primary key')

			// Re-add the unique index with tenant_code first
			await queryInterface.addIndex('certificate_base_templates', ['tenant_code', 'organization_code', 'code'], {
				unique: true,
				name: 'unique_code_per_organization_tenant',
				where: { deleted_at: null },
			})
			console.log('   ✓ certificate_base_templates fixed')
		} catch (error) {
			console.log('   ⚠ certificate_base_templates:', error)
		}

		// 2. Fix comments (partition: tenant_code - changed from resource_id for colocation with resources)
		console.log('2. Fixing comments...')
		try {
			// Remove the unique index
			try {
				await queryInterface.removeIndex('comments', 'unique_comment_resource')
				console.log('   Removed old index')
			} catch (e) {
				console.log('   Note: unique_comment_resource index not found')
			}

			// Remove constraint if it exists
			try {
				await queryInterface.removeConstraint('comments', 'unique_comment_resource')
				console.log('   Removed old constraint')
			} catch (e) {
				console.log('   Note: unique_comment_resource constraint not found')
			}

			// Drop the existing primary key (pk_comments_id_resource)
			await queryInterface.sequelize.query(
				'ALTER TABLE comments DROP CONSTRAINT IF EXISTS pk_comments_id_resource CASCADE;'
			)

			// Also drop the default primary key if it exists
			await queryInterface.sequelize.query(
				'ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_pkey CASCADE;'
			)
			console.log('   Dropped old primary keys')

			// Add new composite primary key with tenant_code first (the partition column)
			await queryInterface.sequelize.query('ALTER TABLE comments ADD PRIMARY KEY (tenant_code, id);')
			console.log('   Added new composite primary key')

			// Re-add the unique index with tenant_code first
			await queryInterface.addIndex('comments', ['tenant_code', 'resource_id', 'id', 'organization_code'], {
				unique: true,
				name: 'unique_comment_resource',
				where: { deleted_at: null },
			})
			console.log('   ✓ comments fixed')
		} catch (error) {
			console.log('   ⚠ comments:', error.message)
		}

		// 3. Fix program_resource_mapping (partition: tenant_code)
		console.log('3. Fixing program_resource_mapping...')
		try {
			// Remove the unique index
			try {
				await queryInterface.removeIndex('program_resource_mapping', 'unique_program_resource_tenant')
				console.log('   Removed old index')
			} catch (e) {
				console.log('   Note: unique_program_resource_tenant index not found')
			}

			// Remove constraint if it exists
			try {
				await queryInterface.removeConstraint('program_resource_mapping', 'unique_program_resource_tenant')
				console.log('   Removed old constraint')
			} catch (e) {
				console.log('   Note: unique_program_resource_tenant constraint not found')
			}

			// Drop the existing primary key
			await queryInterface.sequelize.query(
				'ALTER TABLE program_resource_mapping DROP CONSTRAINT IF EXISTS program_resource_mapping_pkey CASCADE;'
			)
			console.log('   Dropped old primary key')

			// Add new composite primary key with tenant_code first
			await queryInterface.sequelize.query(
				'ALTER TABLE program_resource_mapping ADD PRIMARY KEY (tenant_code, program_id, id);'
			)
			console.log('   Added new composite primary key')

			// Re-add the unique index with tenant_code first
			await queryInterface.addIndex('program_resource_mapping', ['tenant_code', 'program_id', 'resource_id'], {
				unique: true,
				name: 'unique_program_resource_tenant',
				where: { deleted_at: null },
			})
			console.log('   ✓ program_resource_mapping fixed')
		} catch (error) {
			console.log('   ⚠ program_resource_mapping:', error.message)
		}

		// 4. Fix reviews (partition: tenant_code)
		console.log('4. Fixing reviews...')
		try {
			// Remove the unique index
			try {
				await queryInterface.removeIndex('reviews', 'unique_resource_reviewer_tenant_code')
			} catch (e) {
				console.log('   Note: unique_resource_reviewer_tenant_code index not found, skipping')
			}

			// Drop the existing primary key
			await queryInterface.sequelize.query('ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_pkey CASCADE;')

			// Add new composite primary key with tenant_code and organization_code first
			await queryInterface.sequelize.query(
				'ALTER TABLE reviews ADD PRIMARY KEY (tenant_code, organization_code, id);'
			)

			// Re-add the unique index with tenant_code first
			await queryInterface.addIndex(
				'reviews',
				['tenant_code', 'resource_id', 'reviewer_id', 'organization_code'],
				{
					unique: true,
					name: 'unique_resource_reviewer_tenant_code',
					where: { deleted_at: null },
				}
			)
			console.log('   ✓ reviews fixed')
		} catch (error) {
			console.log('   ⚠ reviews:', error.message)
		}

		// 5. Fix rollouts (partition: tenant_code)
		console.log('5. Fixing rollouts...')
		try {
			// Drop the existing primary key
			await queryInterface.sequelize.query(
				'ALTER TABLE rollouts DROP CONSTRAINT IF EXISTS rollouts_pkey CASCADE;'
			)

			// Add new composite primary key with tenant_code and organization_code first
			await queryInterface.sequelize.query(
				'ALTER TABLE rollouts ADD PRIMARY KEY (tenant_code, organization_code, id);'
			)

			// Try to remove index if exists
			try {
				await queryInterface.removeIndex('rollouts', 'unique_rollout_resource_tenant')
			} catch (e) {
				// Index doesn't exist, that's fine
			}

			// Add the unique index with tenant_code first
			await queryInterface.addIndex(
				'rollouts',
				['tenant_code', 'resource_type', 'resource_id', 'organization_code'],
				{
					unique: true,
					name: 'unique_rollout_resource_tenant',
					where: { deleted_at: null },
				}
			)
			console.log('   ✓ rollouts fixed')
		} catch (error) {
			console.log('   ⚠ rollouts:', error.message)
		}

		// 6. Fix forms (partition: tenant_code)
		console.log('6. Fixing forms...')
		try {
			// Remove the unique index
			try {
				await queryInterface.removeIndex('forms', 'unique_type_sub_type_org_id_tenant_code')
			} catch (e) {
				console.log('   Note: unique_type_sub_type_org_id_tenant_code index not found, skipping')
			}

			// Re-add the unique index with tenant_code first
			await queryInterface.addIndex('forms', ['tenant_code', 'organization_code', 'type', 'sub_type'], {
				unique: true,
				name: 'unique_type_sub_type_org_id_tenant_code',
				where: { deleted_at: null },
			})
			console.log('   ✓ forms fixed')
		} catch (error) {
			console.log('   ⚠ forms:', error.message)
		}

		// 7. Fix organization_extensions (partition: tenant_code)
		console.log('7. Fixing organization_extensions...')
		try {
			// Remove the unique index
			try {
				await queryInterface.removeIndex('organization_extensions', 'unique_org_resource_type_tenant')
			} catch (e) {
				console.log('   Note: unique_org_resource_type_tenant index not found, skipping')
			}

			// Re-add the unique index with tenant_code first
			await queryInterface.addIndex(
				'organization_extensions',
				['tenant_code', 'organization_code', 'resource_type'],
				{
					unique: true,
					name: 'unique_org_resource_type_tenant',
					where: { deleted_at: null },
				}
			)
			console.log('   ✓ organization_extensions fixed')
		} catch (error) {
			console.log('   ⚠ organization_extensions:', error.message)
		}

		// 8. Fix organization_configs (partition: tenant_code)
		console.log('8. Fixing organization_configs...')
		try {
			// Remove the unique index
			try {
				await queryInterface.removeIndex('organization_configs', 'unique_org_tenant')
			} catch (e) {
				console.log('   Note: unique_org_tenant index not found, skipping')
			}

			// Re-add the unique index with tenant_code first
			await queryInterface.addIndex('organization_configs', ['tenant_code', 'organization_code'], {
				unique: true,
				name: 'unique_org_tenant',
				where: { deleted_at: null },
			})
			console.log('   ✓ organization_configs fixed')
		} catch (error) {
			console.log('   ⚠ organization_configs:', error.message)
		}

		console.log('')
		console.log('=========================================')
		console.log('Fixing Foreign Key ON UPDATE for Citus')
		console.log('=========================================')
		console.log('')
		console.log('Citus does not support CASCADE, SET NULL, or SET DEFAULT')
		console.log('in ON UPDATE operations when distribution key is in the FK.')
		console.log('Changing all onUpdate to NO ACTION...')
		console.log('')

		// Fix reviews table foreign key
		console.log('9. Fixing reviews foreign key...')
		try {
			// Drop the existing foreign key with CASCADE on update
			await queryInterface.removeConstraint('reviews', 'fk_reviews_resources')
			console.log('   Removed old foreign key constraint')

			// Re-add the foreign key with NO ACTION on update (CASCADE on delete is OK)
			await queryInterface.addConstraint('reviews', {
				fields: ['resource_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_reviews_resources',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onDelete: 'CASCADE',
				onUpdate: 'NO ACTION', // Changed from CASCADE to NO ACTION
			})
			console.log('   ✓ reviews foreign key fixed (onUpdate: NO ACTION)')
		} catch (error) {
			console.log('   ⚠ reviews FK:', error.message)
		}

		// Fix rollouts table foreign key
		console.log('10. Fixing rollouts foreign key...')
		try {
			// Drop the existing foreign key with CASCADE on update
			await queryInterface.removeConstraint('rollouts', 'fk_rollouts_resources')
			console.log('   Removed old foreign key constraint')

			// Re-add the foreign key with NO ACTION on update
			await queryInterface.addConstraint('rollouts', {
				fields: ['resource_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_rollouts_resources',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onDelete: 'CASCADE',
				onUpdate: 'NO ACTION', // Changed from CASCADE to NO ACTION
			})
			console.log('   ✓ rollouts foreign key fixed (onUpdate: NO ACTION)')
		} catch (error) {
			console.log('   ⚠ rollouts FK:', error.message)
		}

		// Fix comments table foreign key
		console.log('11. Fixing comments foreign key...')
		try {
			// Drop the existing foreign key with CASCADE on update
			await queryInterface.removeConstraint('comments', 'fk_comments_resources')
			console.log('   Removed old foreign key constraint')

			// Re-add the foreign key with NO ACTION on update
			await queryInterface.addConstraint('comments', {
				fields: ['resource_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_comments_resources',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onDelete: 'CASCADE',
				onUpdate: 'NO ACTION', // Changed from CASCADE to NO ACTION
			})
			console.log('   ✓ comments foreign key fixed (onUpdate: NO ACTION)')
		} catch (error) {
			console.log('   ⚠ comments FK:', error.message)
		}

		console.log('')
		console.log('=========================================')
		console.log('✅ All constraint and FK fixes completed!')
		console.log('=========================================')
		console.log('')
		console.log('Next steps:')
		console.log('1. Run distribution: psql -d your_db -f src/distributionColumns.psql')
		console.log('2. Verify tables: SELECT * FROM citus_tables;')
		console.log('')
	},

	async down(queryInterface) {
		console.log('=========================================')
		console.log('Rolling back Citus index changes...')
		console.log('=========================================')
		console.log('')

		// Revert all indexes to original order
		const revertOperations = [
			{
				table: 'certificate_base_templates',
				indexName: 'unique_code_per_organization_tenant',
				fields: ['organization_code', 'code', 'tenant_code'],
			},
			{
				table: 'comments',
				indexName: 'unique_comment_resource',
				fields: ['id', 'resource_id', 'organization_code', 'tenant_code'],
			},
			{
				table: 'program_resource_mapping',
				indexName: 'unique_program_resource_tenant',
				fields: ['program_id', 'resource_id', 'tenant_code'],
			},
			{
				table: 'reviews',
				indexName: 'unique_resource_reviewer_tenant_code',
				fields: ['resource_id', 'reviewer_id', 'organization_code', 'tenant_code'],
			},
			{
				table: 'forms',
				indexName: 'unique_type_sub_type_org_id_tenant_code',
				fields: ['organization_code', 'tenant_code', 'type', 'sub_type'],
			},
			{
				table: 'organization_extensions',
				indexName: 'unique_org_resource_type_tenant',
				fields: ['organization_code', 'resource_type', 'tenant_code'],
			},
			{
				table: 'organization_configs',
				indexName: 'unique_org_tenant',
				fields: ['organization_code', 'tenant_code'],
			},
		]

		for (const op of revertOperations) {
			try {
				await queryInterface.removeIndex(op.table, op.indexName)
				await queryInterface.addIndex(op.table, op.fields, {
					unique: true,
					name: op.indexName,
					where: { deleted_at: null },
				})
				console.log(`✓ Reverted ${op.table}`)
			} catch (error) {
				console.log(`⚠ Could not revert ${op.table}:`, error.message)
			}
		}

		// Remove the rollouts index we added
		try {
			await queryInterface.removeIndex('rollouts', 'unique_rollout_resource_tenant')
			console.log('✓ Removed rollouts index')
		} catch (error) {
			console.log('⚠ Could not remove rollouts index')
		}

		console.log('')
		console.log('Reverting foreign key changes...')
		console.log('')

		// Revert reviews FK
		try {
			await queryInterface.removeConstraint('reviews', 'fk_reviews_resources')
			await queryInterface.addConstraint('reviews', {
				fields: ['resource_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_reviews_resources',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE', // Revert to CASCADE
			})
			console.log('✓ Reverted reviews foreign key')
		} catch (error) {
			console.log('⚠ Error reverting reviews FK:', error.message)
		}

		// Revert rollouts FK
		try {
			await queryInterface.removeConstraint('rollouts', 'fk_rollouts_resources')
			await queryInterface.addConstraint('rollouts', {
				fields: ['resource_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_rollouts_resources',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE', // Revert to CASCADE
			})
			console.log('✓ Reverted rollouts foreign key')
		} catch (error) {
			console.log('⚠ Error reverting rollouts FK:', error.message)
		}

		// Revert comments FK
		try {
			await queryInterface.removeConstraint('comments', 'fk_comments_resources')
			await queryInterface.addConstraint('comments', {
				fields: ['resource_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_comments_resources',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE', // Revert to CASCADE
			})
			console.log('✓ Reverted comments foreign key')
		} catch (error) {
			console.log('⚠ Error reverting comments FK:', error.message)
		}

		console.log('')
		console.log('✅ Rollback completed')
		console.log('')
	},
}

'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		const transaction = await queryInterface.sequelize.transaction()

		try {
			// Step 3: Get all admin permissions except admin module and admin-only permissions
			// Excluding:
			// - module = 'admin' (permission_ids: 22, 23, 26)
			// - Admin-only feature permission (40)
			// - Admin-only tenant permission (35)
			// Including organization permissions (8, 28, 29, 30) as per requirement
			const [adminPermissions] = await queryInterface.sequelize.query(
				`SELECT DISTINCT 
          permission_id,
          module,
          request_type,
          api_path,
          created_at,
          updated_at,
          created_by
        FROM role_permission_mapping
        WHERE role_title = 'admin'
          AND module != 'admin'
        ORDER BY permission_id`,
				{ transaction }
			)

			console.log(`Found ${adminPermissions.length} permissions to copy for tenant_admin`)

			// Step 4: Insert permissions for tenant_admin role
			if (adminPermissions.length > 0) {
				const permissionInserts = adminPermissions.map((perm) => ({
					role_title: 'tenant_admin',
					permission_id: perm.permission_id,
					module: perm.module,
					request_type: perm.request_type,
					api_path: perm.api_path,
					created_at: new Date(),
					updated_at: new Date(),
					created_by: perm.created_by,
				}))

				await queryInterface.bulkInsert('role_permission_mapping', permissionInserts, {
					transaction,
					ignoreDuplicates: true,
				})

				console.log(`Inserted ${permissionInserts.length} permissions for tenant_admin role`)
			}

			// Commit transaction
			await transaction.commit()
			console.log('Migration completed successfully')
			console.log('Summary:')
			console.log(`- Assigned permissions: ${adminPermissions.length}`)
			console.log('- Excluded modules: admin')
			console.log('- Excluded permissions: 35 (tenant), 40 (feature full CRUD)')
		} catch (error) {
			// Rollback transaction on error
			await transaction.rollback()
			console.error('Migration failed, rolled back:', error)
			throw error
		}
	},

	down: async (queryInterface, Sequelize) => {
		const transaction = await queryInterface.sequelize.transaction()

		try {
			// Step 1: Delete all tenant_admin permissions from role_permission_mapping
			const [deletePermResult] = await queryInterface.sequelize.query(
				`DELETE FROM role_permission_mapping WHERE role_title = 'tenant_admin'`,
				{ transaction }
			)

			console.log('Deleted all tenant_admin permissions')

			await transaction.commit()
			console.log('Rollback completed successfully')
		} catch (error) {
			await transaction.rollback()
			console.error('Rollback failed:', error)
			throw error
		}
	},
}

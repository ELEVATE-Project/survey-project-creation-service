'use strict'

require('module-alias/register')
const common = require('@constants/common')
const Permissions = require('@database/models/index').Permission

const getPermissionId = async (module, request_type, api_path) => {
	try {
		const permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})

		if (!permission) {
			throw permission
		}

		return permission.id
	} catch (error) {
		throw error
	}
}

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			//create module
			const modulesData = [
				{ code: 'actions', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
				{ code: 'activities', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			]

			// Insert the data into the 'modules' table
			await queryInterface.bulkInsert('modules', modulesData)

			//create permission
			const permissionsData = [
				{
					code: 'action_permissions',
					module: 'actions',
					request_type: ['POST', 'GET', 'DELETE'],
					api_path: '/scp/v1/actions/*',
				},
				{
					code: 'read_action_permissions',
					module: 'actions',
					request_type: ['GET'],
					api_path: '/scp/v1/actions/list*',
				},
				{
					code: 'read_activities_permissions',
					module: 'activities',
					request_type: ['GET'],
					api_path: '/scp/v1/activities/list*',
				},
			]

			const now = new Date()
			const formattedPermissionsData = permissionsData.map((permission) => ({
				...permission,
				status: 'ACTIVE',
				created_at: now,
				updated_at: now,
			}))

			// Now you can use completePermissionsData for your bulk insert
			await queryInterface.bulkInsert('permissions', formattedPermissionsData)

			let rolePermissionsData = []

			// Define admin permissions
			const adminPermissions = [
				{
					module: 'actions',
					request_type: ['POST', 'GET', 'DELETE'],
					api_path: '/scp/v1/actions/*',
					roles: [process.env.DEFAULT_ADMIN_ROLE],
				},
			]

			async function addPermissions(permissions) {
				for (const permission of permissions) {
					const permissionId = await getPermissionId(
						permission.module,
						permission.request_type,
						permission.api_path
					)
					for (const role of permission.roles) {
						rolePermissionsData.push({
							role_title: role,
							permission_id: permissionId,
							module: permission.module,
							request_type: permission.request_type,
							api_path: permission.api_path,
							created_at: new Date(),
							updated_at: new Date(),
							created_by: 0,
						})
					}
				}
			}

			// Add admin permissions
			await addPermissions(adminPermissions)

			let defaultContentCreatorRoles = process.env.DEFAULT_CONTENT_CREATOR_ROLE.split(',') || []
			let defaultReviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',') || []
			const commonAPIRoles = [
				...defaultContentCreatorRoles,
				...defaultReviewerRoles,
				process.env.DEFAULT_ORG_ADMIN_ROLE,
			].filter((role, index, self) => self.indexOf(role) === index) // Remove duplicates

			// Define all permissions to be mapped to roles
			const permissionsToMap = [
				{
					module: 'actions',
					request_type: ['GET'],
					api_path: '/scp/v1/actions/list*',
					roles: [process.env.DEFAULT_ORG_ADMIN_ROLE],
				},
				{
					module: 'activities',
					request_type: ['GET'],
					api_path: '/scp/v1/activities/list*',
					roles: [process.env.DEFAULT_ADMIN_ROLE, ...commonAPIRoles],
				},
			]

			await addPermissions(permissionsToMap)

			await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
		} catch (error) {
			console.error(error)
		}
	},

	down: async (queryInterface, Sequelize) => {
		const paths = ['/scp/v1/actions/*', '/scp/v1/actions/list*', '/scp/v1/activities/list*']

		// Get permission IDs for the given paths
		const [perms] = await queryInterface.sequelize.query('SELECT id FROM permissions WHERE api_path IN (:paths)', {
			replacements: { paths },
		})

		const ids = perms.map((p) => p.id)

		if (ids.length) {
			// Delete from role_permission_mapping where permission_id in ids
			await queryInterface.bulkDelete('role_permission_mapping', { permission_id: ids })

			// Delete from permissions where id in ids
			await queryInterface.bulkDelete('permissions', { id: ids })
		}

		// Delete from modules where code in ['actions','activities']
		await queryInterface.bulkDelete('modules', { code: ['actions', 'activities'] })
	},
}

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
			//create permission
			const permissionsData = [
				{
					code: 'review_approve_permissions',
					module: 'reviews',
					request_type: ['POST', 'PATCH'],
					api_path: '/scp/v1/reviews/approve*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'review_reject_permissions',
					module: 'reviews',
					request_type: ['POST', 'PATCH'],
					api_path: '/scp/v1/reviews/rejectOrReport*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]

			await queryInterface.bulkInsert('permissions', permissionsData)

			let defaultReviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',') || []
			const rolePermissionsData = []

			async function addPermissions(permissions, roles) {
				for (const permission of permissions) {
					const permissionId = await getPermissionId(
						permission.module,
						permission.request_type,
						permission.api_path
					)
					for (const role of roles) {
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

			// Only call addPermissions if reviewer roles are present
			if (defaultReviewerRoles.length > 0) {
				await addPermissions(permissionsData, defaultReviewerRoles);
			}	
			
			if (rolePermissionsData.length > 0) {
				await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData);
			}
		} catch (error) {
			console.error(error)
		}
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('role_permission_mapping', { api_path: '/scp/v1/reviews/approve*' })
		await queryInterface.bulkDelete('role_permission_mapping', { api_path: '/scp/v1/reviews/rejectOrReport*' })
		await queryInterface.bulkDelete('permissions', { code: 'review_approve_permissions' })
		await queryInterface.bulkDelete('permissions', { code: 'review_reject_permissions' })
	},
}

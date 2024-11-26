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
			const modulesData = [{ code: 'rollouts', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() }]

			// Insert the data into the 'modules' table
			await queryInterface.bulkInsert('modules', modulesData)

			//create permission
			const permissionsData = [
				{
					code: 'rollout_permissions',
					module: 'rollouts',
					request_type: ['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
					api_path: '/scp/v1/rollouts/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]

			await queryInterface.bulkInsert('permissions', permissionsData)

			//create role permission mapping
			const rolePermissionsData = [
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'rollouts',
						['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
						'/scp/v1/rollouts/*'
					),
					module: 'rollouts',
					request_type: ['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
					api_path: '/scp/v1/rollouts/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'rollouts',
						['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
						'/scp/v1/rollouts/*'
					),
					module: 'rollouts',
					request_type: ['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
					api_path: '/scp/v1/rollouts/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.PROGRAM_DESIGNER,
					permission_id: await getPermissionId(
						'rollouts',
						['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
						'/scp/v1/rollouts/*'
					),
					module: 'rollouts',
					request_type: ['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
					api_path: '/scp/v1/rollouts/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
			]

			await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
		} catch (error) {
			console.error(error)
		}
	},

	down: async (queryInterface, Sequelize) => {},
}

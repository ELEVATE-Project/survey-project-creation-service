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
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_activities_permissions',
					module: 'activities',
					request_type: ['GET'],
					api_path: '/scp/v1/activities/list*',
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
					permission_id: await getPermissionId('actions', ['POST', 'GET', 'DELETE'], '/scp/v1/actions/*'),
					module: 'actions',
					request_type: ['POST', 'GET', 'DELETE'],
					api_path: '/scp/v1/actions/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId('actions', ['POST', 'GET', 'DELETE'], '/scp/v1/actions/*'),
					module: 'actions',
					request_type: ['POST', 'GET', 'DELETE'],
					api_path: '/scp/v1/actions/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId('activities', ['GET'], '/scp/v1/activities/list*'),
					module: 'activities',
					request_type: ['GET'],
					api_path: '/scp/v1/activities/list*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId('activities', ['GET'], '/scp/v1/activities/list*'),
					module: 'activities',
					request_type: ['GET'],
					api_path: '/scp/v1/activities/list*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('activities', ['GET'], '/scp/v1/activities/list*'),
					module: 'activities',
					request_type: ['GET'],
					api_path: '/scp/v1/activities/list*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('activities', ['GET'], '/scp/v1/activities/list*'),
					module: 'activities',
					request_type: ['GET'],
					api_path: '/scp/v1/activities/list*',
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

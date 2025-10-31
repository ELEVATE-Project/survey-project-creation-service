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
			throw new Error(
				`Permission not found for module=${module}, request_type=${JSON.stringify(
					request_type
				)}, api_path=${api_path}`
			)
		}

		return permission.id
	} catch (error) {
		throw error
	}
}

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			if (!process.env.DEFAULT_ADMIN_ROLE || !process.env.DEFAULT_ORG_ADMIN_ROLE) {
				throw new Error('DEFAULT_ADMIN_ROLE and DEFAULT_ORG_ADMIN_ROLE must be set in the environment')
			}

			//create module
			const modulesData = [
				{ code: 'config_create_or_update', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
				{
					code: 'config_update_related_orgs',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]

			// Insert the data into the 'modules' table
			await queryInterface.bulkInsert('modules', modulesData)

			//create permission
			const permissionsData = [
				{
					code: 'config_create_or_update',
					module: 'config',
					request_type: ['PUT', 'POST'],
					api_path: '/scp/v1/config/createOrUpdate',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'config_update_related_orgs',
					module: 'config',
					request_type: ['PUT', 'POST'],
					api_path: '/scp/v1/config/updateRelatedOrgs',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]

			await queryInterface.bulkInsert('permissions', permissionsData)
			//create role permission mapping
			const rolePermissionsData = [
				{
					role_title: process.env.DEFAULT_ADMIN_ROLE,
					permission_id: await getPermissionId('config', ['PUT', 'POST'], '/scp/v1/config/createOrUpdate'),
					module: 'config',
					request_type: ['PUT', 'POST'],
					api_path: '/scp/v1/config/createOrUpdate',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: process.env.DEFAULT_ORG_ADMIN_ROLE,
					permission_id: await getPermissionId('config', ['PUT', 'POST'], '/scp/v1/config/updateRelatedOrgs'),
					module: 'config',
					request_type: ['PUT', 'POST'],
					api_path: '/scp/v1/config/updateRelatedOrgs',
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

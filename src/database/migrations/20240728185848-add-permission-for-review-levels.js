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
		await queryInterface.bulkDelete('modules', null, {})

		//create module
		const modulesData = [
			{ code: 'review-stages', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
		]

		// Insert the data into the 'modules' table
		await queryInterface.bulkInsert('modules', modulesData)

		//create permission
		const permissionsData = [
			{
				code: 'review_stages_permissions',
				module: 'review-stages',
				request_type: ['PUT', 'GET'],
				api_path: '/scp/v1/review-stages/update',
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
				permission_id: await getPermissionId('review-stages', ['PUT', 'GET'], '/scp/v1/review-stages/*'),
				module: 'review-stages',
				request_type: ['PUT', 'GET'],
				api_path: '/scp/v1/review-stages/*',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
			{
				role_title: common.ORG_ADMIN_ROLE,
				permission_id: await getPermissionId('review-stages', ['PUT', 'GET'], '/scp/v1/review-stages/*'),
				module: 'review-stages',
				request_type: ['PUT', 'GET'],
				api_path: '/scp/v1/review-stages/*',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
		]
	},

	down: async (queryInterface, Sequelize) => {},
}

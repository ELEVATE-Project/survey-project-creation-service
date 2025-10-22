'use strict'

require('module-alias/register')
require('dotenv').config()
const common = require('@constants/common')
const Permissions = require('@database/models/index').Permission

const getPermissionId = async (module, request_type, api_path) => {
	try {
		let permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})

		if (!permission) {
			permission = await createPermission(
				'resource',
				['GET'],
				'/scp/v1/resource/getDeepLink',
				'deeplink_fetch_permissions'
			)
		}
		return permission.id
	} catch (error) {
		throw error
	}
}
const createPermission = async (module, request_type, api_path, code) => {
	try {
		const now = new Date()
		const permission = await Permissions.create({
			module,
			request_type,
			api_path,
			code,
			createdAt: now,
			updatedAt: now,
		})
		return permission
	} catch (error) {
		throw error
	}
}

module.exports = {
	async up(queryInterface, Sequelize) {
		let permission_id = await getPermissionId(common.CONTENT_CREATOR, ['GET'], '/scp/v1/resource/getDeepLink')
		// if(!permission_id){
		// 	permission_id =
		// }
		const rolePermissionsData = [
			{
				role_title: common.CONTENT_CREATOR,
				permission_id,
				module: 'resource',
				request_type: ['GET'],
				api_path: '/scp/v1/resource/getDeepLink',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
		]
		await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('role_permission_mapping', { api_path: '/scp/v1/resource/getDeepLink' }, {})
		await queryInterface.bulkDelete('permissions', { code: 'deeplink_fetch_permissions' }, {})
	},
}

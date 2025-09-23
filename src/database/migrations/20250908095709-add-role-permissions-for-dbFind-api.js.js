'use strict'

require('module-alias/register')
require('dotenv').config()
const Permissions = require('@database/models/index').Permission

const getPermissionId = async (module, request_type, api_path) => {
	try {
		const permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})

		if (!permission) {
			throw 'no permission found'
		}
		return permission.id
	} catch (error) {
		throw error
	}
}

module.exports = {
	async up(queryInterface, Sequelize) {
		const rolePermissionsData = [
			{
				role_title: process.env.DEFAULT_ADMIN_ROLE,
				permission_id: await getPermissionId('admin', ['POST'], '/scp/v1/admin/dbFind'),
				module: 'admin',
				request_type: ['POST'],
				api_path: '/scp/v1/admin/dbFind',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			},
		]
		await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('role_permission_mapping', { api_path: '/scp/v1/admin/dbFind' }, {})
	},
}

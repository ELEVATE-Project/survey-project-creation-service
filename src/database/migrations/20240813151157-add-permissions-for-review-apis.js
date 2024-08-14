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
					code: 'review_start_permissions',
					module: 'reviews',
					request_type: ['POST', 'PATCH'],
					api_path: '/scp/v1/reviews/start*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]

			await queryInterface.bulkInsert('permissions', permissionsData)

			//create role permission mapping
			const rolePermissionsData = [
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('reviews', ['POST', 'PATCH'], '/scp/v1/reviews/start*'),
					module: 'reviews',
					request_type: ['POST', 'PATCH'],
					api_path: '/scp/v1/reviews/start*',
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

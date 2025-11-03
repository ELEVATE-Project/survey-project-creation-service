'use strict'

require('module-alias/register')
require('dotenv').config()
const Permissions = require('@database/models/index').Permission

const getPermissionId = async (module, request_type, api_path) => {
	let permission = await Permissions.findOne({
		where: { module, request_type, api_path },
	})

	if (!permission) {
		permission = await createPermission(
			'projects',
			['POST'],
			'/scp/v1/projects/republish*',
			'projects_republish_permissions'
		)
	}
	return permission.id
}

const createPermission = async (module, request_type, api_path, code) => {
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
}

module.exports = {
	async up(queryInterface, Sequelize) {
		let permission_id = await getPermissionId('projects', ['POST'], '/scp/v1/projects/republish*')

		let defaultContentCreatorRoles = process.env.DEFAULT_CONTENT_CREATOR_ROLE
			? process.env.DEFAULT_CONTENT_CREATOR_ROLE.split(',')
			: []
		let defaultReviewerRoles = process.env.DEFAULT_REVIEWER_ROLE ? process.env.DEFAULT_REVIEWER_ROLE.split(',') : []

		const rolePermissionsData = []

		// Add permissions for content creator roles
		defaultContentCreatorRoles.forEach((role) => {
			rolePermissionsData.push({
				role_title: role.trim(),
				permission_id,
				module: 'projects',
				request_type: ['POST'],
				api_path: '/scp/v1/projects/republish*',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			})
		})

		// Add permissions for reviewer roles
		defaultReviewerRoles.forEach((role) => {
			rolePermissionsData.push({
				role_title: role.trim(),
				permission_id,
				module: 'projects',
				request_type: ['POST'],
				api_path: '/scp/v1/projects/republish/:id',
				created_at: new Date(),
				updated_at: new Date(),
				created_by: 0,
			})
		})

		if (rolePermissionsData.length > 0) {
			await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
		}
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('role_permission_mapping', { api_path: '/scp/v1/projects/republish*' }, {})
		await queryInterface.bulkDelete('permissions', { code: 'projects_republish_permissions' }, {})
	},
}

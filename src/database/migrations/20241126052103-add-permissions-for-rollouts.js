'use strict'

require('module-alias/register')
const common = require('@constants/common')
const Permissions = require('@database/models/index').Permission
const Module = require('@database/models/index').Module
const RolePermissionMapping = require('@database/models/index').RolePermission

const getPermissionId = async (module, request_type, api_path) => {
	try {
		const permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})

		if (!permission) {
			throw new Error(
				`Permission not found for module: ${module}, request_type: ${request_type}, api_path: ${api_path}`
			)
		}
		return permission.id
	} catch (error) {
		throw error
	}
}

// let defaultRoles = process.env.DEFAULT_ROLLOUT_ROLES.split(',') || []
// defaultRoles.push(process.env.DEFAULT_ADMIN_ROLE, process.env.DEFAULT_ORG_ADMIN_ROLE)
const defaultRoles = [
	...(process.env.DEFAULT_ROLLOUT_ROLES || '')
		.split(',')
		.map((r) => r.trim())
		.filter(Boolean),
	process.env.DEFAULT_ADMIN_ROLE,
	process.env.DEFAULT_ORG_ADMIN_ROLE,
].filter(Boolean)

let rolePermissions = [
	{
		module: 'rollouts',
		request_type: ['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
		api_path: '/scp/v1/rollouts/*',
	},
	{
		module: 'cloud-services',
		request_type: ['POST', 'GET'],
		api_path: '/scp/v1/cloud-services/*',
	},
	{
		module: 'entity-types',
		request_type: ['POST'],
		api_path: '/scp/v1/entity-types/read',
	},
	{
		module: 'entities',
		request_type: ['POST'],
		api_path: '/scp/v1/entities/read',
	},
	{
		module: 'form',
		request_type: ['POST'],
		api_path: '/scp/v1/form/read*',
	},
	{
		module: 'config',
		request_type: ['GET'],
		api_path: '/scp/v1/config/list',
	},
	{
		module: 'projects',
		request_type: ['GET'],
		api_path: '/scp/v1/projects/details*',
	},
	{
		module: 'permissions',
		request_type: ['GET'],
		api_path: '/scp/v1/permissions/list',
	},
]

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			//create module
			const [module, createdModule] = await Module.findOrCreate({
				where: { code: 'rollouts' },
				defaults: {
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			})

			const [permission, createdPermission] = await Permissions.findOrCreate({
				where: {
					module: 'rollouts',
					request_type: ['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
					api_path: '/scp/v1/rollouts/*',
					code: 'rollout_permissions',
				},
				defaults: {
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			})

			//add browse existing list permission
			let browseExistingPermission = await Permissions.findOne({
				where: {
					code: 'list_browseExisting_resource_permissions',
					module: 'resource',
				},
			})

			if (browseExistingPermission?.id) {
				//update browse existing list permission
				await Permissions.update(
					{
						code: 'list_browseExisting_resource_permissions',
						module: 'resource',
						request_type: ['GET', 'POST'],
						api_path: '/scp/v1/resource/getPublishedResources*',
					},
					{
						where: {
							id: browseExistingPermission.id,
						},
					}
				)

				rolePermissions.push({
					module: 'resource',
					request_type: ['GET', 'POST'],
					api_path: '/scp/v1/resource/getPublishedResources*',
				})
			}

			for (const role of defaultRoles) {
				const rolePermissionsData = await Promise.all(
					rolePermissions.map(async (perm) => ({
						role_title: role,
						permission_id: await getPermissionId(perm.module, perm.request_type, perm.api_path),
						module: perm.module,
						request_type: perm.request_type,
						api_path: perm.api_path,
					}))
				)

				//remove if permission is already there
				const bulkInsertData = await Promise.all(
					rolePermissionsData.map(async (data) => {
						const exists = await RolePermissionMapping.findOne({
							where: {
								role_title: data.role_title,
								permission_id: data.permission_id,
							},
						})

						if (!exists) {
							return {
								...data,
								created_at: new Date(),
								updated_at: new Date(),
								created_by: 0,
							}
						}
					})
				).then((results) => results.filter(Boolean))

				if (bulkInsertData.length > 0) {
					await queryInterface.bulkInsert('role_permission_mapping', bulkInsertData)
				}
			}
		} catch (error) {
			console.error(error)
		}
	},

	down: async (queryInterface, Sequelize) => {
		// Find the permissions related to 'rollouts'
		const permission = await Permissions.findOne({
			where: {
				module: 'rollouts',
				request_type: ['PUT', 'GET', 'POST', 'DELETE', 'PATCH'],
				api_path: '/scp/v1/rollouts/*',
			},
		})

		// If permission exists, destroy the associated role_permission_mapping records
		if (permission?.id) {
			await RolePermissionMapping.destroy({
				where: {
					permission_id: permission.id,
				},
			})
		}
	},
}

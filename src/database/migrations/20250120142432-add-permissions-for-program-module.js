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

const createOrFindModule = async (moduleCode) => {
	return await Module.findOrCreate({
		where: { code: moduleCode },
		defaults: {
			status: 'ACTIVE',
			created_at: new Date(),
			updated_at: new Date(),
		},
	})
}

const createOrFindPermission = async (permission) => {
	const { module, request_type, api_path, code } = permission
	return await Permissions.findOrCreate({
		where: { module, request_type, api_path, code },
		defaults: {
			status: 'ACTIVE',
			created_at: new Date(),
			updated_at: new Date(),
		},
	})
}

const mapPermissionsToRoles = async (queryInterface, roles, permissions) => {
	for (const role of roles) {
		const rolePermissionsData = await Promise.all(
			permissions.map(async (perm) => ({
				role_title: role,
				permission_id: await getPermissionId(perm.module, perm.request_type, perm.api_path),
				module: perm.module,
				request_type: perm.request_type,
				api_path: perm.api_path,
			}))
		)

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
						created_by: 0, // Assuming the system is creating these mappings
					}
				}
			})
		).then((results) => results.filter(Boolean)) // Filter out undefined values

		if (bulkInsertData.length > 0) {
			await queryInterface.bulkInsert('role_permission_mapping', bulkInsertData)
		}
	}
}

let defaultRoles = process.env.DEFAULT_PROGRAM_DESIGNER_ROLES.split(',') || []
defaultRoles.push(common.ADMIN_ROLE, common.ORG_ADMIN_ROLE)

// New permissions for programs module
const newPermissions = [
	{
		code: 'crud_program_permissions',
		module: 'programs',
		request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
		api_path: '/scp/v1/programs/update*',
	},
	{
		code: 'add_resource_to_program_permission',
		module: 'programs',
		request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
		api_path: '/scp/v1/programs/addResources*',
	},
	{
		code: 'remove_resource_from_program_permission',
		module: 'programs',
		request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
		api_path: '/scp/v1/programs/removeResources*',
	},
	{
		code: 'submit_program_permissions',
		module: 'programs',
		request_type: ['POST'],
		api_path: '/scp/v1/programs/submitForReview*',
	},
	{
		code: 'read_program_permissions',
		module: 'programs',
		request_type: ['GET'],
		api_path: '/scp/v1/programs/details*',
	},
	{
		code: 'reviewer_list_program_permissions',
		module: 'programs',
		request_type: ['GET'],
		api_path: '/scp/v1/programs/reviewerList',
	},
	{
		code: 'program_manager_list_program_permissions',
		module: 'programs',
		request_type: ['GET'],
		api_path: '/scp/v1/programs/getProgramManagers',
	},
	{
		code: 'program_publish_permissions',
		module: 'programs',
		request_type: ['GET'],
		api_path: '/scp/v1/programs/publish*',
	},
]

// Existing permissions for program designer
const existingPermissions = [
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
	{
		module: 'resource',
		request_type: ['GET', 'POST'],
		api_path: '/scp/v1/resource/getPublishedResources*',
	},
	{
		module: 'certificates',
		request_type: ['GET'],
		api_path: '/scp/v1/certificates/list',
	},
	{
		module: 'comments',
		request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
		api_path: '/scp/v1/comments/*',
	},
	{
		module: 'resource',
		request_type: ['GET'],
		api_path: '/scp/v1/resource/list*',
	},
]

// Existing permissions for reviewer for programs module
const existingPermissionsForReviewer = [
	{
		code: 'read_program_permissions',
		module: 'programs',
		request_type: ['GET'],
		api_path: '/scp/v1/programs/details*',
	},
	{
		code: 'program_manager_list_program_permissions',
		module: 'programs',
		request_type: ['GET'],
		api_path: '/scp/v1/programs/getProgramManagers',
	},
	{
		module: 'resource',
		request_type: ['GET', 'POST'],
		api_path: '/scp/v1/resource/getPublishedResources*',
	},
]

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			// Step 1: Create or find the 'programs' module
			await createOrFindModule('programs')

			// Step 2: Create new permissions
			for (const permission of newPermissions) {
				await createOrFindPermission(permission)
			}

			// Step 3: Map permissions to Program designer and admin roles
			await mapPermissionsToRoles(queryInterface, defaultRoles, [...newPermissions, ...existingPermissions])

			// Step 4: Map permissions to reviewer roles
			const reviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',') || []
			if (reviewerRoles.length > 0) {
				await mapPermissionsToRoles(queryInterface, reviewerRoles, existingPermissionsForReviewer)
			}
		} catch (error) {
			console.error('Error during migration:', error)
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			// Step 1: Remove the role permission mappings for `program_designer`
			await queryInterface.sequelize.query(
				"DELETE FROM role_permission_mapping WHERE role_title IN ('program_designer')"
			)

			// Step 2: Remove the permissions for the specified modules
			await queryInterface.sequelize.query("DELETE FROM permissions WHERE module IN ('programs')")

			// Step 3: Remove the `programs` module
			await queryInterface.sequelize.query("DELETE FROM modules WHERE code = 'programs'")
		} catch (error) {
			console.error('Error during rollback:', error)
		}
	},
}

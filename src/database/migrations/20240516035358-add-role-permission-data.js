'use strict'

require('module-alias/register')
const common = require('@constants/common')
const Permissions = require('@database/models/index').Permission

const getPermissionId = async (module, request_type, api_path) => {
	try {
		const permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})

		if (!permission?.id) {
			throw new Error(
				`Permission not found: module=${module}, request_type=${JSON.stringify(
					request_type
				)}, api_path=${api_path}`
			)
		}

		return permission.id
	} catch (error) {
		console.error(`Error fetching permission for ${module} - ${api_path}:`, error)
		throw error
	}
}

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			let defaultContentCreatorRoles = process.env.DEFAULT_CONTENT_CREATOR_ROLE.split(',') || []
			let defaultReviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',') || []

			let adminRoles = [process.env.DEFAULT_ADMIN_ROLE, process.env.DEFAULT_ORG_ADMIN_ROLE]

			const commonPermissionsCCandReviewer = [
				{
					code: 'cloud_services_access',
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/scp/v1/cloud-services/*',
				},
				{
					code: 'read_form_permissions',
					module: 'form',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/form/*',
				},
				{
					code: 'read_entity_type_permissions',
					module: 'entity-types',
					request_type: ['POST'],
					api_path: '/scp/v1/entity-types/read',
				},
				{
					code: 'read_entity_permissions',
					module: 'entities',
					request_type: ['POST'],
					api_path: '/scp/v1/entities/read',
				},
				{
					code: 'read_permissions',
					module: 'permissions',
					request_type: ['GET'],
					api_path: '/scp/v1/permissions/list',
				},
				{
					code: 'list_role_mapping_permissions',
					module: 'role-permission-mapping',
					request_type: ['GET'],
					api_path: '/scp/v1/role-permission-mapping/list',
				},
				{
					code: 'read_certificate_permissions',
					module: 'certificates',
					request_type: ['GET'],
					api_path: '/scp/v1/certificates/list',
				},
				{
					code: 'config_permissions',
					module: 'config',
					request_type: ['GET'],
					api_path: '/scp/v1/config/list',
				},
				{
					code: 'list_resource_permissions',
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/list*',
				},
				{
					code: 'read_project_permissions',
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/details*',
				},
				{
					code: 'comment_permissions',
					module: 'comments',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/comments/*',
				},
			]

			const adminPermissions = [
				{
					code: 'form_permissions',
					module: 'form',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/form/*',
				},
				{
					code: 'entity_type_permissions',
					module: 'entity-types',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/entity-types/*',
				},
				{
					code: 'entity_permissions',
					module: 'entities',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/entities/*',
				},
				{
					code: 'permissions',
					module: 'permissions',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/permissions/*',
				},
				{
					code: 'modules_permissions',
					module: 'modules',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/modules/*',
				},
				{
					code: 'role_mapping_permissions',
					module: 'role-permission-mapping',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/role-permission-mapping/*',
				},
				{
					code: 'certificate_permissions',
					module: 'certificates',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/certificates/*',
				},
				{
					code: 'organization_permissions',
					module: 'organization-extensions',
					request_type: ['POST', 'DELETE', 'PUT', 'PATCH'],
					api_path: '/scp/v1/organization-extensions/*',
				},
				{
					code: 'config_permissions',
					module: 'config',
					request_type: ['GET'],
					api_path: '/scp/v1/config/list',
				},
				{
					code: 'resource_all_permissions',
					module: 'resource',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/resource/*',
				},
				{
					code: 'project_all_permissions',
					module: 'projects',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/projects/*',
				},
				{
					code: 'review_all_permissions',
					module: 'reviews',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/reviews/*',
				},
				{
					code: 'comment_permissions',
					module: 'comments',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/comments/*',
				},
			]

			const contentCreatorPermissions = [
				{
					code: 'create_update_delete_project_permissions',
					module: 'projects',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/projects/update*',
				},
				{
					code: 'submit_project_permissions',
					module: 'projects',
					request_type: ['POST'],
					api_path: '/scp/v1/projects/submitForReview*',
				},
				{
					code: 'reviewer_list_project_permissions',
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/reviewerList',
				},
				{
					code: 'list_browseExisting_resource_permissions',
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/getPublishedResources*',
				},
				{
					code: 'list_browseExisting_resource_details_permissions',
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/details/*',
				},
				{
					code: 'list_users_permissions',
					module: 'users',
					request_type: ['GET'],
					api_path: '/scp/v1/users/list/*',
				},
			]

			const reviewerPermissions = [
				{
					code: 'review_permissions',
					module: 'reviews',
					request_type: ['POST', 'PATCH'],
					api_path: '/scp/v1/reviews/update*',
				},
				{
					code: 'list_upForReview_resource_permissions',
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/upForReview*',
				},
			]

			// Build rolePermissionsData array
			const rolePermissionsData = []

			async function addPermissions(permissions, roles) {
				for (const permission of permissions) {
					const permissionId = await getPermissionId(
						permission.module,
						permission.request_type,
						permission.api_path
					)
					for (const role of roles) {
						rolePermissionsData.push({
							role_title: role,
							permission_id: permissionId,
							module: permission.module,
							request_type: permission.request_type,
							api_path: permission.api_path,
							created_at: new Date(),
							updated_at: new Date(),
							created_by: 0,
						})
					}
				}
			}

			// Add content creator specific permissions
			await addPermissions(contentCreatorPermissions, defaultContentCreatorRoles)

			// Add admin permissions
			await addPermissions(adminPermissions, adminRoles)

			// Add common permissions for content creators and reviewers
			await addPermissions(commonPermissionsCCandReviewer, [
				...defaultContentCreatorRoles,
				...defaultReviewerRoles,
			])

			// Add reviewer specific permissions
			await addPermissions(reviewerPermissions, defaultReviewerRoles)

			await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
		} catch (error) {
			console.error(error)
		}
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('role_permission_mapping', null, {})
	},
}

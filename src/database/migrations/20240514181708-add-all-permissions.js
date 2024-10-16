'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('permissions', null, {})

		try {
			const permissionsData = [
				{
					code: 'get_signedurl_permissions',
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/scp/v1/cloud-services/getSignedUrl',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'cloud_storage_permissions',
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/scp/v1/cloud-services/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'entity_type_permissions',
					module: 'entity-types',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/entity-types/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_entity_type_permissions',
					module: 'entity-types',
					request_type: ['POST'],
					api_path: '/scp/v1/entity-types/read',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'entity_permissions',
					module: 'entities',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/entities/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_entity_permissions',
					module: 'entities',
					request_type: ['POST'],
					api_path: '/scp/v1/entities/read',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'form_permissions',
					module: 'form',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/form/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_form_permissions',
					module: 'form',
					request_type: ['POST'],
					api_path: '/scp/v1/form/read*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'list_resource_permissions',
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/list*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'create_update_delete_project_permissions',
					module: 'projects',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/projects/update*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'submit_project_permissions',
					module: 'projects',
					request_type: ['POST'],
					api_path: '/scp/v1/projects/submitForReview*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_project_permissions',
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/details*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'publish_project_permissions',
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/publish',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'reviewer_list_project_permissions',
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/reviewerList',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'review_permissions',
					module: 'reviews',
					request_type: ['POST', 'PATCH'],
					api_path: '/scp/v1/reviews/update*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'comment_permissions',
					module: 'comments',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/comments/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'certificate_permissions',
					module: 'certificates',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/certificates/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_certificate_permissions',
					module: 'certificates',
					request_type: ['GET'],
					api_path: '/scp/v1/certificates/list',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'organization_permissions',
					module: 'organization-extensions',
					request_type: ['POST', 'DELETE', 'PUT', 'PATCH'],
					api_path: '/scp/v1/organization-extensions/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'config_permissions',
					module: 'config',
					request_type: ['GET'],
					api_path: '/scp/v1/config/list',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'permissions',
					module: 'permissions',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/permissions/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'read_permissions',
					module: 'permissions',
					request_type: ['GET'],
					api_path: '/scp/v1/permissions/list',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'modules_permissions',
					module: 'modules',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/modules/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'role_mapping_permissions',
					module: 'role-permission-mapping',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/role-permission-mapping/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'list_role_mapping_permissions',
					module: 'role-permission-mapping',
					request_type: ['GET'],
					api_path: '/scp/v1/role-permission-mapping/list',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'list_observation_permission',
					module: 'observations',
					request_type: ['GET'],
					api_path: '/scp/v1/observations/list',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'list_upForReview_resource_permissions',
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/upForReview*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'list_browseExisting_resource_permissions',
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/getPublishedResources*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'list_browseExisting_resource_details_permissions',
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/details/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
				{
					code: 'list_users_permissions',
					module: 'users',
					request_type: ['GET'],
					api_path: '/scp/v1/users/list/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]
			await queryInterface.bulkInsert('permissions', permissionsData)
		} catch (error) {
			console.log(error)
		}
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('permissions', null, {})
	},
}

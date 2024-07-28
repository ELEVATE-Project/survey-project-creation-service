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
			const rolePermissionsData = [
				//cloud services permissions
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId('cloud-services', ['POST', 'GET'], '/scp/v1/cloud-services/*'),
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/scp/v1/cloud-services/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId('cloud-services', ['POST', 'GET'], '/scp/v1/cloud-services/*'),
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/scp/v1/cloud-services/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('cloud-services', ['POST', 'GET'], '/scp/v1/cloud-services/*'),
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/scp/v1/cloud-services/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.RESOURCE_CREATOR,
					permission_id: await getPermissionId('cloud-services', ['POST', 'GET'], '/scp/v1/cloud-services/*'),
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/scp/v1/cloud-services/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('cloud-services', ['POST', 'GET'], '/scp/v1/cloud-services/*'),
					module: 'cloud-services',
					request_type: ['POST', 'GET'],
					api_path: '/scp/v1/cloud-services/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//form permissions
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'form',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/form/*'
					),
					module: 'form',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/form/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'form',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/form/*'
					),
					module: 'form',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/form/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('form', ['POST'], '/scp/v1/form/read*'),
					module: 'form',
					request_type: ['POST'],
					api_path: '/scp/v1/form/read*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('form', ['POST'], '/scp/v1/form/read*'),
					module: 'form',
					request_type: ['POST'],
					api_path: '/scp/v1/form/read*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.RESOURCE_CREATOR,
					permission_id: await getPermissionId('form', ['POST'], '/scp/v1/form/read*'),
					module: 'form',
					request_type: ['POST'],
					api_path: '/scp/v1/form/read*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//entity types permissions
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'entity-types',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/entity-types/*'
					),
					module: 'entity-types',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/entity-types/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'entity-types',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/entity-types/*'
					),
					module: 'entity-types',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/entity-types/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('entity-types', ['POST'], '/scp/v1/entity-types/read'),
					module: 'entity-types',
					request_type: ['POST'],
					api_path: '/scp/v1/entity-types/read',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('entity-types', ['POST'], '/scp/v1/entity-types/read'),
					module: 'entity-types',
					request_type: ['POST'],
					api_path: '/scp/v1/entity-types/read',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.RESOURCE_CREATOR,
					permission_id: await getPermissionId('entity-types', ['POST'], '/scp/v1/entity-types/read'),
					module: 'entity-types',
					request_type: ['POST'],
					api_path: '/scp/v1/entity-types/read',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//entities
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'entities',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/entities/*'
					),
					module: 'entities',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/entities/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'entities',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/entities/*'
					),
					module: 'entities',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/entities/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('entities', ['POST'], '/scp/v1/entities/read'),
					module: 'entities',
					request_type: ['POST'],
					api_path: '/scp/v1/entities/read',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.RESOURCE_CREATOR,
					permission_id: await getPermissionId('entities', ['POST'], '/scp/v1/entities/read'),
					module: 'entities',
					request_type: ['POST'],
					api_path: '/scp/v1/entities/read',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('entities', ['POST'], '/scp/v1/entities/read'),
					module: 'entities',
					request_type: ['POST'],
					api_path: '/scp/v1/entities/read',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//permissions
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'permissions',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/permissions/*'
					),
					module: 'permissions',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/permissions/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'permissions',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/permissions/*'
					),
					module: 'permissions',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/permissions/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('permissions', ['GET'], '/scp/v1/permissions/list'),
					module: 'permissions',
					request_type: ['GET'],
					api_path: '/scp/v1/permissions/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('permissions', ['GET'], '/scp/v1/permissions/list'),
					module: 'permissions',
					request_type: ['GET'],
					api_path: '/scp/v1/permissions/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.RESOURCE_CREATOR,
					permission_id: await getPermissionId('permissions', ['GET'], '/scp/v1/permissions/list'),
					module: 'permissions',
					request_type: ['GET'],
					api_path: '/scp/v1/permissions/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//modules
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'modules',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/modules/*'
					),
					module: 'modules',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/modules/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'modules',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/modules/*'
					),
					module: 'modules',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/modules/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//role permission mapping
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'role-permission-mapping',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/role-permission-mapping/*'
					),
					module: 'role-permission-mapping',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/role-permission-mapping/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'role-permission-mapping',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/role-permission-mapping/*'
					),
					module: 'role-permission-mapping',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/role-permission-mapping/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId(
						'role-permission-mapping',
						['GET'],
						'/scp/v1/role-permission-mapping/list'
					),
					module: 'role-permission-mapping',
					request_type: ['GET'],
					api_path: '/scp/v1/role-permission-mapping/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId(
						'role-permission-mapping',
						['GET'],
						'/scp/v1/role-permission-mapping/list'
					),
					module: 'role-permission-mapping',
					request_type: ['GET'],
					api_path: '/scp/v1/role-permission-mapping/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.RESOURCE_CREATOR,
					permission_id: await getPermissionId(
						'role-permission-mapping',
						['GET'],
						'/scp/v1/role-permission-mapping/list'
					),
					module: 'role-permission-mapping',
					request_type: ['GET'],
					api_path: '/scp/v1/role-permission-mapping/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				// certificate templates
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'certificates',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/certificates/*'
					),
					module: 'certificates',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/certificates/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'certificates',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/certificates/*'
					),
					module: 'certificates',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/certificates/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('certificates', ['GET'], '/scp/v1/certificates/list'),
					module: 'certificates',
					request_type: ['GET'],
					api_path: '/scp/v1/certificates/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('certificates', ['GET'], '/scp/v1/certificates/list'),
					module: 'certificates',
					request_type: ['GET'],
					api_path: '/scp/v1/certificates/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				// organization extensions
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId(
						'organization-extensions',
						['POST', 'DELETE', 'PUT', 'PATCH'],
						'/scp/v1/organization-extensions/*'
					),
					module: 'organization-extensions',
					request_type: ['POST', 'DELETE', 'PUT', 'PATCH'],
					api_path: '/scp/v1/organization-extensions/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId(
						'organization-extensions',
						['POST', 'DELETE', 'PUT', 'PATCH'],
						'/scp/v1/organization-extensions/*'
					),
					module: 'organization-extensions',
					request_type: ['POST', 'DELETE', 'PUT', 'PATCH'],
					api_path: '/scp/v1/organization-extensions/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//config list
				{
					role_title: common.ADMIN_ROLE,
					permission_id: await getPermissionId('config', ['GET'], '/scp/v1/config/list'),
					module: 'config',
					request_type: ['GET'],
					api_path: '/scp/v1/config/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.ORG_ADMIN_ROLE,
					permission_id: await getPermissionId('config', ['GET'], '/scp/v1/config/list'),
					module: 'config',
					request_type: ['GET'],
					api_path: '/scp/v1/config/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('config', ['GET'], '/scp/v1/config/list'),
					module: 'config',
					request_type: ['GET'],
					api_path: '/scp/v1/config/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('config', ['GET'], '/scp/v1/config/list'),
					module: 'config',
					request_type: ['GET'],
					api_path: '/scp/v1/config/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.RESOURCE_CREATOR,
					permission_id: await getPermissionId('config', ['GET'], '/scp/v1/config/list'),
					module: 'config',
					request_type: ['GET'],
					api_path: '/scp/v1/config/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//resource permissions
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('resource', ['GET'], '/scp/v1/resource/list*'),
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/list*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('resource', ['GET'], '/scp/v1/resource/list*'),
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/list*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//project permissions
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('projects', ['GET'], '/scp/v1/projects/details*'),
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/details*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('projects', ['GET'], '/scp/v1/projects/details*'),
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/details*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId(
						'projects',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/projects/update*'
					),
					module: 'projects',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/projects/update*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('projects', ['POST'], '/scp/v1/projects/submitForReview*'),
					module: 'projects',
					request_type: ['POST'],
					api_path: '/scp/v1/projects/submitForReview*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('projects', ['GET'], '/scp/v1/projects/reviewerList'),
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/reviewerList',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('projects', ['GET'], '/scp/v1/projects/publish'),
					module: 'projects',
					request_type: ['GET'],
					api_path: '/scp/v1/projects/publish',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//review permissions
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('reviews', ['POST', 'PATCH'], '/scp/v1/reviews/update*'),
					module: 'reviews',
					request_type: ['POST', 'PATCH'],
					api_path: '/scp/v1/reviews/update*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//comments
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId(
						'comments',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/comments/*'
					),
					module: 'comments',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/comments/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId(
						'comments',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/comments/*'
					),
					module: 'comments',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/comments/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.RESOURCE_CREATOR,
					permission_id: await getPermissionId(
						'comments',
						['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
						'/scp/v1/comments/*'
					),
					module: 'comments',
					request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
					api_path: '/scp/v1/comments/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},

				//observations
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('observations', ['GET'], '/scp/v1/observations/list'),
					module: 'observations',
					request_type: ['GET'],
					api_path: '/scp/v1/observations/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('observations', ['GET'], '/scp/v1/observations/list'),
					module: 'observations',
					request_type: ['GET'],
					api_path: '/scp/v1/observations/list',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('resource', ['GET'], '/scp/v1/resource/upForReview*'),
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/upForReview*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('resource', ['GET'], '/scp/v1/resource/browseExisting*'),
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/browseExisting*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('resource', ['GET'], '/scp/v1/resource/details/*'),
					module: 'resource',
					request_type: ['GET'],
					api_path: '/scp/v1/resource/details/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.CONTENT_CREATOR,
					permission_id: await getPermissionId('users', ['GET'], '/scp/v1/users/list/*'),
					module: 'users',
					request_type: ['GET'],
					api_path: '/scp/v1/users/list/*',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				},
				{
					role_title: common.REVIEWER,
					permission_id: await getPermissionId('users', ['GET'], '/scp/v1/users/list/*'),
					module: 'users',
					request_type: ['GET'],
					api_path: '/scp/v1/users/list/*',
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

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('role_permission_mapping', null, {})
	},
}

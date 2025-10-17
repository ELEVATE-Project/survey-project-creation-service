'use strict'

require('module-alias/register')
const Permissions = require('@database/models/index').Permission

const getPermissionId = async (module, request_type, api_path) => {
	try {
		const permission = await Permissions.findOne({
			where: { module, request_type, api_path },
		})

		if (!permission) {
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
	async up(queryInterface) {
		try {
			// Step 1: Validate environment variables
			if (!process.env.DEFAULT_CONTENT_CREATOR_ROLE || !process.env.DEFAULT_REVIEWER_ROLE) {
				throw new Error(
					'Required environment variables are not defined. Please set DEFAULT_CONTENT_CREATOR_ROLE and DEFAULT_REVIEWER_ROLE'
				)
			}

			// Step 2: Create the permission
			const permissionsData = [
				{
					code: 'observable_entity_types',
					module: 'entity-types',
					request_type: ['GET'],
					api_path: '/scp/v1/entity-types/getObservableEntityTypes',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]
			await queryInterface.bulkInsert('permissions', permissionsData)

			// Step 3: Get permission ID for the newly created permission
			const permissionId = await getPermissionId(
				'entity-types',
				['GET'],
				'/scp/v1/entity-types/getObservableEntityTypes'
			)

			// Step 4: Get role titles from environment variables
			const contentCreatorRoles = process.env.DEFAULT_CONTENT_CREATOR_ROLE.split(',').filter((role) =>
				role.trim()
			)
			const reviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',').filter((role) => role.trim())

			// Validate that we have at least one role
			if (contentCreatorRoles.length === 0 && reviewerRoles.length === 0) {
				throw new Error('No valid roles found in DEFAULT_CONTENT_CREATOR_ROLE or DEFAULT_REVIEWER_ROLE')
			}

			// Combine all roles that should have access
			const allRoles = [...contentCreatorRoles, ...reviewerRoles]

			console.log(`Found ${allRoles.length} roles to grant permission: ${allRoles.join(', ')}`)

			// Step 5: Create role permission mappings for each role
			const rolePermissionsData = []

			for (const roleTitle of allRoles) {
				rolePermissionsData.push({
					role_title: roleTitle.trim(),
					permission_id: permissionId,
					module: 'entity-types',
					request_type: ['GET'],
					api_path: '/scp/v1/entity-types/getObservableEntityTypes',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
				})
			}

			await queryInterface.bulkInsert('role_permission_mapping', rolePermissionsData)
			console.log(`✅ Successfully added permission and role mappings for ${rolePermissionsData.length} roles`)
		} catch (error) {
			console.error('Migration failed:', error)
			throw error
		}
	},

	async down(queryInterface) {
		// Remove role permission mappings first (due to foreign key constraint)
		await queryInterface.bulkDelete(
			'role_permission_mapping',
			{ api_path: '/scp/v1/entity-types/getObservableEntityTypes' },
			{}
		)

		// Then remove the permission
		await queryInterface.bulkDelete('permissions', { code: 'observable_entity_types' }, {})
	},
}

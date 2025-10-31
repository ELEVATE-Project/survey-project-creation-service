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
			const modulesData = [
				{ code: 'targeting', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			]

			// Insert the data into the 'modules' table
			await queryInterface.bulkInsert('modules', modulesData)

			// Step 2: Create the permission
			const permissionsData = [
				{
					code: 'targeting_read_apis',
					module: 'targeting',
					request_type: ['GET', 'POST'],
					api_path: '/scp/v1/targeting/*',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
				},
			]
			await queryInterface.bulkInsert('permissions', permissionsData)

			// Step 3: Get permission ID for the newly created permission
			const permissionId = await getPermissionId('targeting', ['GET', 'POST'], '/scp/v1/targeting/*')

			// Step 4: Get role titles from environment variables
			const contentCreatorRoles = process.env.DEFAULT_CONTENT_CREATOR_ROLE.split(',').filter((role) =>
				role.trim()
			)
			const reviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',').filter((role) => role.trim())
			const programRoles = [
				...process.env.DEFAULT_PROGRAM_MANAGERS.split(',').filter((role) => role.trim()),
				...process.env.DEFAULT_PROGRAM_DESIGNER_ROLES.split(',').filter((role) => role.trim()),
			]
			const rolloutRoles = process.env.DEFAULT_ROLLOUT_ROLES.split(',').filter((role) => role.trim())

			// Validate that we have at least one role
			if (contentCreatorRoles.length === 0 && reviewerRoles.length === 0) {
				throw new Error('No valid roles found in DEFAULT_CONTENT_CREATOR_ROLE or DEFAULT_REVIEWER_ROLE')
			}

			// Validate that we have at least one role
			if (programRoles.length === 0 && rolloutRoles.length === 0) {
				throw new Error('No valid roles found in DEFAULT_CONTENT_CREATOR_ROLE or DEFAULT_REVIEWER_ROLE')
			}

			// Combine all roles that should have access
			const allRoles = [...contentCreatorRoles, ...reviewerRoles, ...rolloutRoles, ...programRoles]

			console.log(`Found ${allRoles.length} roles to grant permission: ${allRoles.join(', ')}`)

			// Step 5: Create role permission mappings for each role
			const rolePermissionsData = []

			for (const roleTitle of allRoles) {
				rolePermissionsData.push({
					role_title: roleTitle.trim(),
					permission_id: permissionId,
					module: 'targeting',
					request_type: ['GET', 'POST'],
					api_path: '/scp/v1/targeting/*',
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
		await queryInterface.bulkDelete('role_permission_mapping', { api_path: '/scp/v1/targeting/*' }, {})

		// Then remove the permission
		await queryInterface.bulkDelete('permissions', { code: 'targeting_read_apis' }, {})
		// Then remove the module
		await queryInterface.bulkDelete('modules', { code: 'targeting' }, {})
	},
}

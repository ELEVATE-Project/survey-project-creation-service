'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const now = new Date()

		// Get environment variables
		const organizationCode = process.env.DEFAULT_ORGANIZATION_CODE || 'default_code'
		const tenantCode = process.env.DEFAULT_TENANT_CODE || 'default'
		const resourceTypesString = process.env.RESOURCE_TYPES

		if (!resourceTypesString) {
			throw new Error('RESOURCE_TYPES environment variable is undefined. Please make sure it is set.')
		}

		const resourceTypes = resourceTypesString.split(',').map((type) => type.trim())

		// Fetch all existing records in a single query
		const existingRecords = await queryInterface.sequelize.query(
			`SELECT resource_type FROM organization_extensions 
			 WHERE organization_code = :organizationCode 
			 AND tenant_code = :tenantCode 
			 AND resource_type IN (:resourceTypes)
			 AND deleted_at IS NULL`,
			{
				replacements: {
					organizationCode,
					tenantCode,
					resourceTypes,
				},
				type: Sequelize.QueryTypes.SELECT,
			}
		)

		// Create a Set of existing resource types for fast lookup
		const existingResourceTypes = new Set(existingRecords.map((record) => record.resource_type))

		// Prepare organization extension records for resource types that don't exist
		const organizationExtensions = resourceTypes
			.filter((resourceType) => !existingResourceTypes.has(resourceType))
			.map((resourceType) => ({
				organization_code: organizationCode,
				tenant_code: tenantCode,
				resource_type: resourceType,
				review_required: process.env.REVIEW_REQUIRED === 'false' ? false : true,
				review_required_after_publish: process.env.REVIEW_REQUIRED_AFTER_PUBLISH === 'false' ? false : true,
				show_reviewer_list: process.env.SHOW_REVIEWER_LIST === 'false' ? false : true,
				min_approval: parseInt(process.env.MIN_APPROVAL) || 1,
				review_type: (process.env.REVIEW_TYPE || 'SEQUENTIAL').toUpperCase(),
				enable_entity_tagging:
					resourceType == 'project' && process.env.ENABLE_ENTITY_TAGGING_IN_PROJECTS === 'true'
						? true
						: false,
				created_at: now,
				updated_at: now,
			}))

		// Insert organization extensions if there are any new records
		if (organizationExtensions.length > 0) {
			await queryInterface.bulkInsert('organization_extensions', organizationExtensions)
		}
	},

	async down(queryInterface) {
		const organizationCode = process.env.DEFAULT_ORGANIZATION_CODE || 'default_code'
		const tenantCode = process.env.DEFAULT_TENANT_CODE || 'default'
		const resourceTypesString = process.env.RESOURCE_TYPES

		if (!resourceTypesString) {
			throw new Error('RESOURCE_TYPES environment variable is undefined. Please make sure it is set.')
		}

		const resourceTypes = resourceTypesString.split(',')

		// Remove the default org extension records for all resource types
		for (const resourceType of resourceTypes) {
			await queryInterface.bulkDelete('organization_extensions', {
				organization_code: organizationCode,
				tenant_code: tenantCode,
				resource_type: resourceType.trim(),
			})
		}
	},
}

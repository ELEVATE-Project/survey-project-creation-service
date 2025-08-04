'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
		if (!defaultTenantCode) {
			throw new Error('DEFAULT_TENANT_CODE environment variable is undefined. Please make sure it is set.')
		}

		const defaultResources = process.env.RESOURCE_TYPES.split(',')
		const defaultReviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',')

		let reviewStagesValues = []
		// iterate through the default resources and default review roles
		// create default review stages with level set to 1
		defaultResources.forEach((resource) => {
			defaultReviewerRoles.forEach((role) => {
				let resourceWiseRows = {
					role: role,
					level: 1,
					resource_type: resource,
					organization_code: defaultOrgId,
					tenant_code: defaultTenantCode,
					created_at: new Date(),
					updated_at: new Date(),
				}
				reviewStagesValues.push(resourceWiseRows)
			})
		})

		await queryInterface.bulkInsert('review_stages', reviewStagesValues, {})
	},

	async down(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw 'Default organization_code is undefined. Please make sure it is set in sequelize options.'
		}

		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
		if (!defaultTenantCode) {
			throw new Error('DEFAULT_TENANT_CODE environment variable is undefined. Please make sure it is set.')
		}

		const defaultResources = process.env.RESOURCE_TYPES.split(',')
		const defaultReviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',')
		let defaultReviewStageValues = []

		// Remove all the default review stages created
		defaultResources.forEach((resource) => {
			defaultReviewerRoles.forEach((role) => {
				let resourceWiseRows = {
					role: role,
					resource_type: resource,
					organization_code: defaultOrgId,
					tenant_code: defaultTenantCode,
				}
				defaultReviewStageValues.push(resourceWiseRows)
			})
		})

		// Iterate through each stages and delete matching rows
		for (const reviewStages of defaultReviewStageValues) {
			await queryInterface.bulkDelete('review_stages', reviewStages, {})
		}
	},
}

'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
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
					organization_id: defaultOrgId,
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
		const defaultResources = process.env.RESOURCE_TYPES.split(',')
		const defaultReviewerRoles = process.env.DEFAULT_REVIEWER_ROLE.split(',')
		let defaultReviewStageValues = []

		// Remove all the default review stages created
		defaultResources.forEach((resource) => {
			defaultReviewerRoles.forEach((role) => {
				let resourceWiseRows = {
					role: role,
					resource_type: resource,
					organization_id: defaultOrgId,
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

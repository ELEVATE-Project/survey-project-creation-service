'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		const defaultResources = process.env.RESOURCE_TYPES.split(',')
		let reviewStagesValues = defaultResources.map((resource) => {
			let resourceWiseRows = {
				role: process.env.DEFAULT_REVIEWER_ROLE,
				level: 1,
				resource_type: resource,
				organization_id: defaultOrgId,
				created_at: new Date(),
				updated_at: new Date(),
			}
			return resourceWiseRows
		})

		await queryInterface.bulkInsert('review_stages', reviewStagesValues, {})
	},

	async down(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		const defaultResources = process.env.RESOURCE_TYPES.split(',')

		// Generate where conditions for each resource type
		const whereConditions = defaultResources.map((resource) => ({
			role: process.env.DEFAULT_REVIEWER_ROLE,
			resource_type: resource,
			organization_id: defaultOrgId,
		}))

		// Iterate through each condition and delete matching rows
		for (const condition of whereConditions) {
			await queryInterface.bulkDelete('review_stages', condition, {})
		}
	},
}

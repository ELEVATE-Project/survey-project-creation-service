'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('actions', null, {})

		const actionsData = [
			{
				code: 'CREATE_PROJECT',
				description: 'created the project with',
			},
			{
				code: 'PROJECT_SUBMITTED',
				description: 'submitted the project with',
			},
			{
				code: 'DELETE_PROJECT',
				description: 'deleted the project with',
			},
			{
				code: 'PROJECT_REJECTED',
				description: 'rejected the project with',
			},
			{
				code: 'PROJECT_REJECTED_AND_REPORTED',
				description: 'rejected and reported the project with',
			},
			{
				code: 'PROJECT_REVIEW_STARTED',
				description: 'started review for project',
			},
			{
				code: 'PROJECT_REVIEW_INPROGRESS',
				description: 'review is in progress for project',
			},
			{
				code: 'PROJECT_REVIEW_CHANGES_REQUESTED',
				description: 'requested changes in project',
			},
			{
				code: 'PROJECT_APPROVED',
				description: 'approved the project with',
			},
			{
				code: 'PROJECT_PUBLISHED',
				description: 'published the project with',
			},
		]

		const actionsFinalArray = actionsData.map((action) => {
			const timestamp = new Date()
			return {
				...action,
				created_at: timestamp,
				updated_at: timestamp,
			}
		})

		// Insert the data into the 'actions' table
		await queryInterface.bulkInsert('actions', actionsFinalArray)
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('actions', null, {})
	},
}

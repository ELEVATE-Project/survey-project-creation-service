'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('actions', null, {})

		const actionsData = [
			{
				code: 'CREATE_PROJECT',
				description: 'Project created',
			},
			{
				code: 'SUBMIT_PROJECT',
				description: 'Project submitted',
			},
			{
				code: 'DELETE_PROJECT',
				description: 'Project deleted',
			},
			{
				code: 'PROJECT_REJECTED',
				description: 'Project rejected',
			},
			{
				code: 'PROJECT_REPORTED',
				description: 'Project reported',
			},
			{
				code: 'PROJECT_REVIEW_STARTED',
				description: 'Project Review started',
			},
			{
				code: 'PROJECT_REVIEW_INPROGRESS',
				description: 'Project Review in progress',
			},
			{
				code: 'PROJECT_REVIEW_CHANGES_REQUESTED',
				description: 'Project review changes requested',
			},
			{
				code: 'PROJECT_APPROVED',
				description: 'Project approved',
			},
			{
				code: 'PROJECT_PUBLISHED',
				description: 'Project published',
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

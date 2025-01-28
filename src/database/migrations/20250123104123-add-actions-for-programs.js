'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('actions', null, {})

		const actionsData = [
			{
				code: 'CREATE_PROGRAM',
				description: 'created the program with',
			},
			{
				code: 'PROGRAM_SUBMITTED',
				description: 'submitted the program with',
			},
			{
				code: 'DELETE_PROGRAM',
				description: 'deleted the program with',
			},
			{
				code: 'PROGRAM_REJECTED',
				description: 'rejected the program with',
			},
			{
				code: 'PROGRAM_REJECTED_AND_REPORTED',
				description: 'rejected and reported the program with',
			},
			{
				code: 'PROGRAM_REVIEW_STARTED',
				description: 'started review for program',
			},
			{
				code: 'PROGRAM_REVIEW_INPROGRESS',
				description: 'review is in progress for program',
			},
			{
				code: 'PROGRAM_REVIEW_CHANGES_REQUESTED',
				description: 'requested changes in program',
			},
			{
				code: 'PROGRAM_APPROVED',
				description: 'approved the program with',
			},
			{
				code: 'PROGRAM_PUBLISHED',
				description: 'published the program with',
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
		await queryInterface.bulkDelete(
			'actions',
			{
				code: {
					[Sequelize.Op.in]: [
						'CREATE_PROGRAM',
						'PROGRAM_SUBMITTED',
						'PROGRAM_REJECTED',
						'PROGRAM_REJECTED_AND_REPORTED',
						'PROGRAM_REVIEW_STARTED',
						'PROGRAM_REVIEW_INPROGRESS',
						'PROGRAM_REVIEW_CHANGES_REQUESTED',
						'PROGRAM_APPROVED',
						'PROGRAM_PUBLISHED',
					],
				},
			},
			{}
		)
	},
}

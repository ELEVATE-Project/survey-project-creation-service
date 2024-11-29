'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		const actionsData = [
			{
				code: 'CREATE_PROGRAM_ROLLOUT',
				description: 'created the Program rollout with',
			},
			{
				code: 'CREATE_SOLUTION_ROLLOUT',
				description: 'created the Solution rollout with',
			},
			{
				code: 'DELETE_PROGRAM_ROLLOUT',
				description: 'deleted the Program rollout with',
			},
			{
				code: 'DELETE_SOLUTION_ROLLOUT',
				description: 'deleted the Solution rollout with',
			},
			{
				code: 'PROGRAM_ROLLOUT_PUBLISHED',
				description: 'published the Program rollout with',
			},
			{
				code: 'SOLUTION_ROLLOUT_PUBLISHED',
				description: 'published the Solution rollout with',
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
						'CREATE_PROGRAM_ROLLOUT',
						'CREATE_SOLUTION_ROLLOUT',
						'DELETE_PROGRAM_ROLLOUT',
						'DELETE_SOLUTION_ROLLOUT',
						'PROGRAM_ROLLOUT_PUBLISHED',
						'SOLUTION_ROLLOUT_PUBLISHED',
					],
				},
			},
			{}
		)
	},
}

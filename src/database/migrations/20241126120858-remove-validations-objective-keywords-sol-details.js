'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const entityTypeArray = [
			{
				entityType: 'solution_details',
				validation: [
					{ type: 'required', value: false },
					{ type: 'max_length', value: 256, message: 'Name must not exceed 256 characters' },
				],
			},
			{
				entityType: 'objective',
				validation: [
					{ type: 'required', value: true, message: 'Summarize the goal of the project' },
					{ type: 'max_length', value: 2000, message: 'Objective must not exceed 2000 characters' },
				],
			},
			{
				entityType: 'keywords',
				validation: [
					{ type: 'required', value: false },
					{ type: 'max_length', value: 256, message: 'Keyword must not exceed 256 characters' },
				],
			},
		]
		// entityTypeArray.forEach(async (eachEntityType) => {
		// 	await queryInterface.bulkUpdate(
		// 		'entity_types',
		// 		{ validations: JSON.stringify(eachEntityType.validation) },
		// 		{ value: eachEntityType.entityType }
		// 	)
		// })
		await Promise.all(
			entityTypeArray.map((eachEntityType) =>
				queryInterface.bulkUpdate(
					'entity_types',
					{ validations: JSON.stringify(eachEntityType.validation) },
					{ value: eachEntityType.entityType }
				)
			)
		)
	},

	async down(queryInterface, Sequelize) {
		const entityTypeArray = [
			{
				entityType: 'objective',
				validation: { regex: `[^A-Za-z0-9 <>_&-]`, required: true },
			},
			{
				entityType: 'keywords',
				validation: { regex: `[^A-Za-z0-9 <>_&-]`, required: false },
			},
			{
				entityType: 'solution_details',
				validation: { required: false, regex: '^[a-zA-Z0-9 <>_&-]{1,256}$' },
			},
		]
		// entityTypeArray.forEach(async (eachEntityType) => {
		// 	await queryInterface.bulkUpdate(
		// 		'entity_types',
		// 		{ validations: eachEntityType.validation },
		// 		{ value: eachEntityType.entityType }
		// 	)
		// })

		await Promise.all(
			entityTypeArray.map((eachEntityType) =>
				queryInterface.bulkUpdate(
					'entity_types',
					{ validations: JSON.stringify(eachEntityType.validation) },
					{ value: eachEntityType.entityType }
				)
			)
		)
	},
}

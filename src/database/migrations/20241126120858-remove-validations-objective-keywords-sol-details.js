'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const entityTypeArray = [
			{
				entityType: 'solution_details',
				validation: { required: false },
			},
			{
				entityType: 'objective',
				validation: { required: true },
			},
			{
				entityType: 'keywords',
				validation: { required: false },
			},
		]
		entityTypeArray.forEach(async (eachEntityType) => {
			await queryInterface.bulkUpdate(
				'entity_types',
				{ validations: eachEntityType.validation },
				{ value: eachEntityType.entityType }
			)
		})
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
		entityTypeArray.forEach(async (eachEntityType) => {
			await queryInterface.bulkUpdate(
				'entity_types',
				{ validations: eachEntityType.validation },
				{ value: eachEntityType.entityType }
			)
		})
	},
}

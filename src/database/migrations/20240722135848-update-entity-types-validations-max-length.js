'use strict'

module.exports = {
	async up(queryInterface, Sequelize) {
		// as per the discussion with products , all text field length is set to 256 and text-area tp 2000
		const char_length_map = {
			title: 256,
			description: 2000,
			learning_resources: 256,
			objective: 2000,
			keywords: 256,
		}

		const [results] = await queryInterface.sequelize.query(
			`SELECT id,value,validations FROM entity_types WHERE value IN ('title','description','learning_resources','objective','keywords');`
		)

		// Iterate over the results and update the validations field
		for (const row of results) {
			const currentValidations = row.validations ? row.validations : {}

			// // Add max_length validation
			let updatedValidations = {
				...currentValidations,
				max_length: char_length_map[row.value],
			}
			if (row.value === 'learning_resources') {
				updatedValidations.required = false
			}

			await queryInterface.bulkUpdate(
				'entity_types',
				{ validations: JSON.stringify(updatedValidations) },
				{ id: row.id }
			)
		}
	},

	async down(queryInterface, Sequelize) {
		// Revert the validations to remove the max_length field for rows with value = 'title'
		const [results] = await queryInterface.sequelize.query(
			`SELECT id, validations FROM entity_types WHERE value IN ('title','description','learning_resources');`
		)

		for (const row of results) {
			const currentValidations = row.validations ? row.validations : {}

			// Remove max_length validation
			const { max_length, ...restValidations } = currentValidations

			await queryInterface.bulkUpdate(
				'entity_types',
				{ validations: JSON.stringify(restValidations) },
				{ id: row.id }
			)
		}
	},
}

'use strict'

module.exports = {
	async up(queryInterface, Sequelize) {
		// as per the discussion with products , all text field length is set to 256 and text-area tp 2000

		const validations = {
			title: { required: true, regex: "^[a-zA-Z0-9 <>_&-' ]+$" },
			description: { required: true, regex: "^[a-zA-Z0-9 <>_&-' ]+$" },
			objective: { required: true, regex: "^[a-zA-Z0-9 <>_&-' ]+$" },
			name: { required: true, regex: "^[a-zA-Z0-9 <>_&-' ]+$" },
			keywords: { required: false, regex: '^[a-zA-Z0-9 <>_&-,]$+' },
			learning_resources: {
				required: false,
				regex: `^(https?:\\/\\/)?([\\w-]+\\.)+[\\w-]{2,}(\\/\\S*)*\\/?(#[\\w-]*)?(\\?.*)?$`,
			},
		}

		const [results] = await queryInterface.sequelize.query(
			`SELECT id,value,validations FROM entity_types WHERE value IN ('title','description','learning_resources','objective','keywords','name');`
		)

		// Iterate over the results and update the validations field
		for (const row of results) {
			let updatedValidations = validations[row.value]

			try {
				await queryInterface.bulkUpdate(
					'entity_types',
					{ validations: JSON.stringify(updatedValidations) },
					{ id: row.id }
				)
			} catch (error) {
				console.log(error, 'error')
			}
		}
	},

	async down(queryInterface, Sequelize) {},
}

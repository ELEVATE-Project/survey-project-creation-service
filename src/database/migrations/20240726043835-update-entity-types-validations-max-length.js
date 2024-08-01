'use strict'

module.exports = {
	async up(queryInterface, Sequelize) {
		// as per the discussion with products , all text field length is set to 256 and text-area tp 2000

		const validations = {
			title: { required: true, regex: ['[^A-Za-z0-9 <>_&-]', '[/^.{1,256}$/]'] },
			description: { required: true, regex: ['[^A-Za-z0-9 <>_&-]', '[/^.{1,2000}$/]'] },
			objective: { required: true, regex: ['[^A-Za-z0-9 <>_&-]', '[/^.{1,2000}$/]'] },
			name: { required: true, regex: ['[^A-Za-z0-9 <>_&-]', '[/^.{1,256}$/]'] },
			keywords: { required: false, regex: ['[^A-Za-z0-9 <>_&-]', '[/^.{1,256}$/]'] },
			learning_resources: { required: false, regex: ['^(?!-)[A-Za-z0-9-]+([-.]{1}[a-z0-9]+)*.[A-Za-z]{2,6}$'] },
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

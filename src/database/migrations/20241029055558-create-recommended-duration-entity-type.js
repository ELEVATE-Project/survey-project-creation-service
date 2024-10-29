/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
			if (!defaultOrgId) {
				throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
			}

			// Insert learning_resource_name entity_type
			const entityTypeData = [
				{
					validations: JSON.stringify([
						{
							type: 'required',
							value: true,
							message: 'Enter duration in numbers',
						},
						{
							type: 'regex',
							value: '^(?:[1-9][0-9]{0,4}|100000)$',
							message: 'Only Number allowed',
						},
					]),
					value: 'recommended_duration',
					label: 'Number',
					data_type: 'ARRAY[STRING]',
					status: 'ACTIVE',
					updated_at: new Date(),
					created_at: new Date(),
					created_by: 0,
					updated_by: 0,
					allow_filtering: false,
					organization_id: defaultOrgId,
					has_entities: false,
					allow_custom_entities: false,
				},
			]

			await queryInterface.bulkInsert('entity_types', entityTypeData, {})
		} catch (error) {
			console.log(error, 'error')
		}
	},

	async down(queryInterface, Sequelize) {
		try {
			// Define condition to remove the inserted entity_type
			await queryInterface.bulkDelete(
				'entity_types',
				{
					value: 'recommended_duration',
					organization_id: queryInterface.sequelize.options.defaultOrgId,
				},
				{}
			)
		} catch (error) {
			console.error('Error during rollback:', error)
		}
	},
}

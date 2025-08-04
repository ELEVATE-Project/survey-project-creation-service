/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
			if (!defaultOrgId) {
				throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
			}

			const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
			if (!defaultTenantCode) {
				throw new Error('DEFAULT_TENANT_CODE environment variable is undefined. Please make sure it is set.')
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
					tenant_code: defaultTenantCode,
					has_entities: false,
					allow_custom_entities: false,
				},
			]

			await queryInterface.bulkInsert('entity_types', entityTypeData, {})

			const entityTypes = await queryInterface.sequelize.query(
				'SELECT * FROM entity_types WHERE value = :entityTypeValue AND organization_id = :defaultOrgId',
				{
					type: queryInterface.sequelize.QueryTypes.SELECT,
					replacements: { entityTypeValue: 'recommended_duration', defaultOrgId },
				}
			)

			if (!entityTypes.length) {
				throw new Error(`Entity type 'recommended_duration' not found for organization ID ${defaultOrgId}`)
			}

			//create entity model mapping
			// Create entity model mapping for the found entity_type_id
			const entityModelMapping = entityTypes.map((entityType) => ({
				entity_type_id: entityType.id,
				tenant_code: defaultTenantCode,
				model: 'project',
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
			}))

			await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})
		} catch (error) {
			console.log(error, 'error')
		}
	},

	async down(queryInterface, Sequelize) {
		try {
			const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
			const entityType = await queryInterface.rawSelect(
				'entity_types',
				{
					where: {
						value: 'recommended_duration',
						organization_id: queryInterface.sequelize.options.defaultOrgId,
					},
				},
				['id'] // Select only the 'id' field
			)

			if (entityType) {
				await queryInterface.bulkDelete(
					'entities_model_mapping',
					{
						entity_type_id: entityType,
						tenant_code: defaultTenantCode,
					},
					{}
				)

				// Define condition to remove the inserted entity_type
				await queryInterface.bulkDelete(
					'entity_types',
					{
						value: 'recommended_duration',
						organization_id: queryInterface.sequelize.options.defaultOrgId,
					},
					{}
				)
			}
		} catch (error) {
			console.error('Error during rollback:', error)
		}
	},
}

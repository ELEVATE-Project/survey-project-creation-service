/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
		if (!defaultTenantCode) {
			throw new Error('DEFAULT_TENANT_CODE environment variable is undefined. Please make sure it is set.')
		}

		const entityTypeArray = [
			{
				entityType: 'title',
				model: ['program'],
			},
			{
				entityType: 'objective',
				model: ['program'],
			},
			{
				entityType: 'licenses',
				model: ['program'],
			},
			{
				entityType: 'start_date',
				model: ['program'],
			},
			{
				entityType: 'end_date',
				model: ['program'],
			},
			{
				entityType: 'viewers',
				model: ['program'],
			},
			{
				entityType: 'targeting_criteria',
				model: ['program'],
			},
		]

		// Fetch existing entity types
		const existingEntityTypes = await queryInterface.sequelize.query('SELECT value FROM entity_types', {
			type: queryInterface.sequelize.QueryTypes.SELECT,
		})

		const existingEntityTypeValues = existingEntityTypes.map((type) => type.value)

		// Filter out entity types that already exist
		const newEntityTypes = entityTypeArray.filter((entity) => !existingEntityTypeValues.includes(entity.entityType))

		// Add entity type details for new entity types
		const entityTypeFinalArray = newEntityTypes.map((entity) => {
			const { entityType, has_entities, validation, model } = entity
			return {
				value: entityType,
				label: convertToWords(entityType),
				data_type: 'ARRAY[STRING]',
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
				created_by: 0,
				updated_by: 0,
				allow_filtering: false,
				organization_code: defaultOrgId,
				tenant_code: defaultTenantCode,
				has_entities,
				allow_custom_entities: false,
				validations: validation ? JSON.stringify(validation) : null,
			}
		})

		// Create new entity types
		if (entityTypeFinalArray.length > 0) {
			await queryInterface.bulkInsert('entity_types', entityTypeFinalArray, {})
		}

		// Fetch all entity types including the newly inserted ones
		const entityTypes = await queryInterface.sequelize.query('SELECT * FROM entity_types', {
			type: queryInterface.sequelize.QueryTypes.SELECT,
		})

		// Create entity model mapping
		let entityModelMapping = []
		entityTypeArray.forEach((entity) => {
			const entityType = entityTypes.find((type) => type.value === entity.entityType)
			if (entityType) {
				entity.model.forEach((model) => {
					let data = {
						entity_type_id: entityType.id,
						tenant_code: defaultTenantCode,
						model: model,
						status: 'ACTIVE',
						updated_at: new Date(),
						created_at: new Date(),
					}
					entityModelMapping.push(data)
				})
			}
		})

		// Insert entity model mappings
		if (entityModelMapping.length > 0) {
			await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})
		}
	},

	async down(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const entityTypeArray = [
			{
				entityType: 'title',
				model: ['program'],
			},
			{
				entityType: 'objective',
				model: ['program'],
			},
			{
				entityType: 'licenses',
				model: ['program'],
			},
			{
				entityType: 'start_date',
				model: ['program', 'resource'],
			},
			{
				entityType: 'end_date',
				model: ['program', 'resource'],
			},
			{
				entityType: 'viewers',
				model: ['program'],
			},
			{
				entityType: 'targeting_criteria',
				model: ['program'],
			},
		]

		// Fetch the entity types from the database
		const entityTypes = await queryInterface.sequelize.query(
			`SELECT id, value FROM entity_types WHERE organization_code = :defaultOrgId AND value IN (:entityTypeValues)`,
			{
				replacements: {
					defaultOrgId,
					entityTypeValues: entityTypeArray.map((entity) => entity.entityType),
				},
				type: queryInterface.sequelize.QueryTypes.SELECT,
			}
		)

		// Extract entity type IDs
		const entityTypeIds = entityTypes.map((type) => type.id)

		// Remove entity model mappings for the specific entity types
		if (entityTypeIds.length > 0) {
			await queryInterface.sequelize.query(
				`DELETE FROM entities_model_mapping WHERE entity_type_id IN (:entityTypeIds)`,
				{
					replacements: { entityTypeIds },
					type: queryInterface.sequelize.QueryTypes.DELETE,
				}
			)
		}
	},
}

function convertToWords(inputString) {
	const words = inputString.replace(/_/g, ' ').split(' ')

	const capitalizedWords = words.map((word) => {
		return word.charAt(0).toUpperCase() + word.slice(1)
	})

	const result = capitalizedWords.join(' ')

	return result
}

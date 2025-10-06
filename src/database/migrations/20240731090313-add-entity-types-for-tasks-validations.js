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
				entityType: 'id',
				has_entities: false,
				validation: { required: true },
				model: ['tasks', 'subTasks'],
			},
			{
				entityType: 'type',
				has_entities: false,
				validation: { required: true },
				model: ['tasks', 'subTasks'],
			},
			{
				entityType: 'is_mandatory',
				has_entities: false,
				validation: { required: true },
				model: ['tasks'],
			},
			{
				entityType: 'allow_evidences',
				has_entities: false,
				validation: { required: true },
				model: ['tasks'],
			},
			{
				entityType: 'parent_id',
				has_entities: false,
				validation: { required: true },
				model: ['subTasks'],
			},
			{
				entityType: 'sequence_no',
				has_entities: false,
				validation: { required: true, regex: '^-?\\d+$' },
				model: ['tasks', 'subTasks'],
			},
			{
				entityType: 'min_no_of_evidences',
				has_entities: false,
				validation: { required: false, regex: '^([1-9]|10)$' },
				model: ['tasks'],
			},
			{
				entityType: 'solution_details',
				has_entities: false,
				validation: { required: false, regex: "^[a-zA-Z0-9 <>_&'\\-]+$" },
				model: ['tasks'],
			},
		]

		//add entity type details
		const entityTypeFinalArray = entityTypeArray.map((entity) => {
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

		//create entity type
		await queryInterface.bulkInsert('entity_types', entityTypeFinalArray, {})

		const entityTypes = await queryInterface.sequelize.query('SELECT * FROM entity_types', {
			type: queryInterface.sequelize.QueryTypes.SELECT,
		})

		//create entity model mapping
		let entityModelMapping = []
		entityTypeArray.map((entity) => {
			const entityType = entityTypes.find((type) => type.value === entity.entityType)
			if (entityType) {
				for (let pointerToModel = 0; pointerToModel < entity.model.length; pointerToModel++) {
					let data = {
						entity_type_id: entityType.id,
						tenant_code: defaultTenantCode,
						organization_code: defaultOrgId,
						model: entity.model[pointerToModel],
						status: 'ACTIVE',
						updated_at: new Date(),
						created_at: new Date(),
					}
					entityModelMapping.push(data)
				}
			}
		})

		await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})
	},

	async down(queryInterface, Sequelize) {
		const values = [
			'id',
			'type',
			'is_mandatory',
			'allow_evidences',
			'parent_id',
			'sequence_no',
			'min_no_of_evidences',
			'solution_details',
		]
		const { Op } = Sequelize
		const rows = await queryInterface.sequelize.query(
			'SELECT id FROM entity_types WHERE value IN (:values)',
			{ replacements: { values }, type: queryInterface.sequelize.QueryTypes.SELECT }
		)
		const ids = rows.map((r) => r.id)
		if (ids.length) {
			await queryInterface.bulkDelete('entities_model_mapping', { entity_type_id: { [Op.in]: ids } }, {})
			await queryInterface.bulkDelete('entity_types', { id: { [Op.in]: ids } }, {})
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

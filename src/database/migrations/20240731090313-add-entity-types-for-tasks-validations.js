/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
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
				validation: { required: false, regex: '^[a-zA-Z0-9 <>_&-]{1,256}$' },
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
				organization_id: defaultOrgId,
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

	async down(queryInterface, Sequelize) {},
}

function convertToWords(inputString) {
	const words = inputString.replace(/_/g, ' ').split(' ')

	const capitalizedWords = words.map((word) => {
		return word.charAt(0).toUpperCase() + word.slice(1)
	})

	const result = capitalizedWords.join(' ')

	return result
}

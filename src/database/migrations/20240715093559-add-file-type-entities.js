/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const entitiesArray = [
			{
				entityType: 'file_types',
				entities: [
					{ value: 'Images', label: 'Images' },
					{ value: 'Document', label: 'Document' },
					{ value: 'Videos', label: 'Videos' },
					{ value: 'Audio', label: 'Audio' },
				],
				has_entities: true,
				validation: { required: false },
				model: 'tasks',
			},
		]

		const entityTypeFinalArray = entitiesArray.map((entity) => {
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
		await queryInterface.bulkInsert('entity_types', entityTypeFinalArray, {})

		const entityTypes = await queryInterface.sequelize.query('SELECT * FROM entity_types', {
			type: queryInterface.sequelize.QueryTypes.SELECT,
		})

		const entityModelMapping = entitiesArray.map((entity) => {
			const entityType = entityTypes.find((type) => type.value === entity.entityType)
			return {
				entity_type_id: entityType.id,
				model: entity.model,
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
			}
		})

		await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})

		const entitiesFinalArray = entityTypes.reduce((acc, eachType) => {
			const entityData = entitiesArray.find((entity) => entity.entityType === eachType.value)
			if (entityData && eachType.has_entities) {
				entityData.entities.forEach((eachEntity) => {
					acc.push({
						...eachEntity,
						entity_type_id: eachType.id,
						type: 'SYSTEM',
						status: 'ACTIVE',
						created_at: new Date(),
						updated_at: new Date(),
						created_by: 0,
						updated_by: 0,
					})
				})
			}
			return acc
		}, [])

		await queryInterface.bulkInsert('entities', entitiesFinalArray, {})

		//add model mapping for learning resource
		const learningResourceEntityType = await queryInterface.sequelize.query(
			'SELECT id FROM entity_types WHERE value = :value',
			{
				type: queryInterface.sequelize.QueryTypes.SELECT,
				replacements: { value: 'learning_resources' },
			}
		)
		if (learningResourceEntityType && learningResourceEntityType.length > 0) {
			let learningResourceEntityTypeId = learningResourceEntityType.map((item) => {
				return item.id
			})

			let learningResourceModelMapping = [
				{
					entity_type_id: learningResourceEntityTypeId,
					model: 'projects',
					status: 'ACTIVE',
					updated_at: new Date(),
					created_at: new Date(),
				},
			]

			await queryInterface.bulkInsert('entities_model_mapping', learningResourceModelMapping, {})
		}
	},

	async down(queryInterface, Sequelize) {
		const entityTypes = await queryInterface.sequelize.query('SELECT id FROM entity_types WHERE value = :value', {
			type: queryInterface.sequelize.QueryTypes.SELECT,
			replacements: { value: 'allowed_file_types' },
		})

		let entityTypeId = entityTypes.map((item) => {
			return item.id
		})

		await queryInterface.bulkDelete('entity_types', {
			id: {
				[Sequelize.Op.in]: entityTypeId,
			},
		})
		await queryInterface.bulkDelete(
			'entities',
			{
				entity_type_id: {
					[Sequelize.Op.in]: entityTypeId,
				},
			},
			{}
		)

		await queryInterface.bulkDelete(
			'entities_model_mapping',
			{
				entity_type_id: {
					[Sequelize.Op.in]: entityTypeId,
				},
			},
			{}
		)
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

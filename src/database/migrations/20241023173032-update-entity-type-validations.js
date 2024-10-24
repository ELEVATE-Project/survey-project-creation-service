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
							type: 'regex',
							value: '^[a-zA-Z0-9 <>_&-]{1,256}$',
							message: 'Name can only include alphanumeric characters with spaces, -, _, &, <>',
						},
						{
							type: 'required',
							value: false,
							message: 'Enter Name of the resource',
						},
						{
							type: 'max_length',
							value: 256,
							message: 'Name must not exceed 256 characters',
						},
					]),
					value: 'learning_resource_name',
					label: 'Name',
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

			// Fetch the inserted learning_resource_name entity
			const [nameEntityData] = await queryInterface.sequelize.query(
				`SELECT * FROM entity_types WHERE value = :learning_resource_name`,
				{
					type: queryInterface.sequelize.QueryTypes.SELECT,
					replacements: { learning_resource_name: 'learning_resource_name' },
				}
			)

			if (!nameEntityData) {
				throw new Error('Entity type with value learning_resource_name not found')
			}

			// Insert model mappings
			let models = ['tasks', 'project']
			const entityModelMapping = models.map((model) => {
				return {
					entity_type_id: nameEntityData.id,
					model: model,
					status: 'ACTIVE',
					updated_at: new Date(),
					created_at: new Date(),
				}
			})

			await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})

			// Process and update entity types
			const entityTypeValues = [
				'recommended_for',
				'categories',
				'languages',
				'licenses',
				'tasks',
				'file_types',
				'notes',
				'title',
				'objective',
				'name',
				'learning_resources',
				'id',
				'type',
				'is_mandatory',
				'parent_id',
				'sequence_no',
				'min_no_of_evidences',
				'allow_evidences',
				'keywords',
				'duration',
				'solution_details',
			]

			const entityTypes = await queryInterface.sequelize.query(
				`SELECT * FROM entity_types WHERE value IN (:entityTypeValues)`,
				{
					type: queryInterface.sequelize.QueryTypes.SELECT,
					replacements: { entityTypeValues },
				}
			)

			//add entity type details
			for (const entityType of entityTypes) {
				let transformedValidation = transformValidation(entityType.validations, entityType.value)
				let updatedValidation = transformedValidation ? JSON.stringify(transformedValidation) : null

				//update value of duration as recommended_duration
				if (entityType.value == 'duration') {
					await queryInterface.bulkUpdate(
						'entity_types',
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
									message: getNewMessage(),
								},
							]),
							value: 'recommended_duration',
						},
						{ id: entityType.id }
					)
				} else if (entityType.value == 'sequence_no') {
					await queryInterface.bulkUpdate(
						'entity_types',
						{
							validations: JSON.stringify([
								{
									type: 'required',
									value: true,
								},
								{
									type: 'regex',
									value: '^[1-9]\\d*$',
									message: 'Only numbers allowed',
								},
							]),
							value: 'recommended_duration',
						},
						{ id: entityType.id }
					)
				} else if (updatedValidation) {
					await queryInterface.bulkUpdate(
						'entity_types',
						{ validations: updatedValidation },
						{ id: entityType.id }
					)
				}
			}
		} catch (error) {
			console.log(error, 'error')
		}
	},

	async down(queryInterface, Sequelize) {},
}

function transformValidation(validation, entityType) {
	let transformedData = []
	if (!validation) return transformedData

	if (validation.regex) {
		let data = { type: 'regex', value: validation.regex }
		if (getNewMessage(entityType, 'regex')) {
			data.message = getNewMessage(entityType, 'regex')
		}
		transformedData.push(data)
	}

	if (validation.required !== undefined) {
		let data = { type: 'required', value: validation.required }
		if (getNewMessage(entityType, 'required')) {
			data.message = getNewMessage(entityType, 'required')
		}
		transformedData.push(data)
	}

	if (entityType == 'objective' || entityType == 'name') {
		let data = { type: 'max_length', value: 2000 }
		if (getNewMessage(entityType, 'max_length')) {
			data.message = getNewMessage(entityType, 'required')
		}
		transformedData.push(data)
	}
	if (['keywords', 'title'].includes(entityType)) {
		let data = { type: 'max_length', value: 256 }
		if (getNewMessage(entityType, 'max_length')) {
			data.message = getNewMessage(entityType, 'max_length')
		}
		transformedData.push(data)
	}

	return transformedData
}

function getNewMessage(entityType, validationType) {
	const messages = {
		title: {
			regex: 'Project title can only include alphanumeric characters with spaces, -, _, &, <>',
			required: 'Enter valid project title',
			max_length: 'Project title must not exceed 256 characters',
		},
		categories: { required: 'Add project category' },
		objective: {
			regex: 'Objective can only include alphanumeric characters with spaces, -, _, &, <>',
			required: 'Summarize the goal of the project',
			max_length: 'Objective must not exceed 2000 characters',
		},
		keywords: {
			regex: 'Keyword can only include alphanumeric characters with spaces, -, _, &, <>',
			required: 'Add a tag',
			max_length: 'Keyword must not exceed 256 characters',
		},
		recommended_for: { required: 'Select role' },
		languages: { required: 'Select language' },
		learning_resources: {
			regex: 'Please add a valid link to resource',
			required: 'Enter link to the resource',
		},
		name: {
			regex: 'Description can only include alphanumeric characters with spaces, -, _, &, <>',
			required: 'Enter description for task',
			max_length: 'Description title must not exceed 2000 characters',
		},
		licenses: { required: 'Select license' },
		is_mandatory: { required: 'is_mandatory field is required' },
		allow_evidences: { required: 'allow_evidences field is required' },
		min_no_of_evidences: { required: 'min_no_of_evidences field is required' },
	}

	return messages[entityType]?.[validationType] || null
}

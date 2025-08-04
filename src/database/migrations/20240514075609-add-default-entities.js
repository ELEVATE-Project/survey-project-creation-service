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

			const entitiesArray = [
				{
					entityType: 'title',
					entities: '',
					has_entities: false,
					validation: { regex: `^[a-zA-Z0-9 <>_&'\\-]+$`, required: true },
					model: 'project',
				},
				{
					entityType: 'categories',
					entities: [],
					has_entities: true,
					validation: { required: true },
					model: 'project',
				},
				{
					entityType: 'objective',
					entities: '',
					has_entities: false,
					validation: { regex: `[^A-Za-z0-9 <>_&-]`, required: true },
					model: 'project',
				},
				{
					entityType: 'keywords',
					entities: '',
					has_entities: false,
					validation: { regex: `[^A-Za-z0-9 <>_&-]`, required: false },
					model: 'project',
				},
				{
					entityType: 'recommended_for',
					entities: [],
					has_entities: true,
					validation: { required: true },
					model: 'project',
				},
				{
					entityType: 'languages',
					entities: [
						{ value: 'en', label: 'English' },
						{ value: 'hi', label: 'Hindi' },
						{ value: 'assamese', label: 'Assamese' },
						{ value: 'bengali', label: 'Bengali' },
						{ value: 'gujarati', label: 'Gujarati' },
						{ value: 'kannada', label: 'Kannada' },
						{ value: 'kashmiri', label: 'Kashmiri' },
						{ value: 'konkani', label: 'Konkani' },
						{ value: 'malayalam', label: 'Malayalam' },
						{ value: 'manipuri', label: 'Manipuri' },
						{ value: 'marathi', label: 'Marathi' },
						{ value: 'nepali', label: 'Nepali' },
						{ value: 'oriya', label: 'Oriya' },
						{ value: 'punjabi', label: 'Punjabi' },
						{ value: 'sanskrit', label: 'Sanskrit' },
						{ value: 'sindhi', label: 'Sindhi' },
						{ value: 'tamil', label: 'Tamil' },
						{ value: 'telugu', label: 'Telugu' },
					],
					has_entities: true,
					validation: { required: true },
					model: 'project',
				},
				{
					entityType: 'licenses',
					entities: [
						{ value: 'cc_by_4.0', label: 'CC BY 4.0' },
						{ value: 'cc_by_nc', label: 'CC BY NC' },
						{ value: 'cc_by_nc_nd', label: 'CC BY NC ND' },
						{ value: 'cc_by_nd', label: 'CC BY ND' },
						{ value: 'cc_by_sa', label: 'CC BY SA' },
						{ value: 'cc_by_nc_sa', label: 'CC BY NC SA' },
					],
					has_entities: true,
					validation: { required: true },
					model: 'project',
				},
				{
					entityType: 'tasks',
					entities: '',
					has_entities: false,
					validation: { required: true },
					model: 'project',
				},
				{
					entityType: 'name',
					entities: '',
					has_entities: false,
					validation: { regex: `^[a-zA-Z0-9 <>_&'\\-]+$`, required: true },
					model: 'tasks',
				},
				{
					entityType: 'learning_resources',
					entities: '',
					has_entities: false,
					validation: {
						regex: `^(https?:\\/\\/)?([\\w-]+\\.)+[\\w-]{2,}(\\/\\S*)*\\/?(#[\\w-]*)?(\\?.*)?$`,
						required: true,
					},
					model: 'subTasks',
				},
				{
					entityType: 'duration',
					entities: [
						{ value: 'days', label: 'Days' },
						{ value: 'weeks', label: 'Weeks' },
						{ value: 'months', label: 'Months' },
					],
					has_entities: true,
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
					organization_code: defaultOrgId,
					tenant_code: defaultTenantCode,
					has_entities,
					allow_custom_entities: false,
					validations: validation ? JSON.stringify(validation) : null,
				}
			})
			await queryInterface.bulkInsert('entity_types', entityTypeFinalArray, {})

			const entityTypes = await queryInterface.sequelize.query('SELECT * FROM entity_types', {
				type: queryInterface.sequelize.QueryTypes.SELECT,
			})

			const entityModelMapping = entitiesArray
				.map((entity) => {
					const entityType = entityTypes.find((type) => type.value === entity.entityType)
					if (entity?.model) {
						return {
							entity_type_id: entityType.id,
							tenant_code: defaultTenantCode,
							model: entity.model,
							status: 'ACTIVE',
							updated_at: new Date(),
							created_at: new Date(),
						}
					}
				})
				.filter((item) => item !== undefined)

			await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})

			const entitiesFinalArray = entityTypes.reduce((acc, eachType) => {
				const entityData = entitiesArray.find((entity) => entity.entityType === eachType.value)
				if (
					entityData &&
					eachType.has_entities &&
					Array.isArray(entityData?.entities) &&
					entityData.entities.length > 0
				) {
					entityData.entities.forEach((eachEntity) => {
						acc.push({
							...eachEntity,
							entity_type_id: eachType.id,
							tenant_code: defaultTenantCode,
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
		} catch (error) {
			console.error('ERR : : ', error)
		}
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('entity_types', null, {})
		await queryInterface.bulkDelete('entities', null, {})
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

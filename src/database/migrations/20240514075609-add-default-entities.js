/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const entitiesArray = [
			{
				entityType: 'resources',
				entities: [
					{ value: 'projects', label: 'Project' },
					{ value: 'observations', label: 'Observation' },
					{ value: 'observation_with_rubrics', label: 'Observation with rubric' },
					{ value: 'surveys', label: 'Survey' },
					{ value: 'programs', label: 'Program' },
				],
				has_entities: true,
				validation: null,
				model: 'resources',
			},
			{
				entityType: 'categories',
				entities: [
					{ value: 'teachers', label: 'Teachers' },
					{ value: 'students', label: 'Students' },
					{ value: 'community', label: 'Community' },
					{ value: 'schoolProcess', label: 'School Process' },
					{ value: 'infrastructure', label: 'Infrastructure' },
					{ value: 'educationLeader', label: 'Education Leader' },
					{ value: 'other', label: 'Other' },
				],
				has_entities: true,
				validation: null,
				model: 'project',
			},
			{
				entityType: 'recommended_for',
				entities: [
					{ value: 'hm', label: 'HM' },
					{ value: 'ht', label: 'HT' },
					{ value: 'teachers', label: 'Teachers' },
					{ value: 'educationLeader', label: 'Education Leader' },
				],
				has_entities: true,
				validation: null,
				model: 'project',
			},
			{
				entityType: 'languages',
				entities: [
					{ value: 'en', label: 'English' },
					{ value: 'hi', label: 'Hindi' },
				],
				has_entities: true,
				validation: null,
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
				validation: null,
				model: 'project',
			},
			{
				entityType: 'title',
				entities: '',
				has_entities: false,
				validation: { regex: `/[^A-Za-z0-9 <>_&-]/` },
				model: 'project',
			},
			{
				entityType: 'objective',
				entities: '',
				has_entities: false,
				validation: { regex: `/[^A-Za-z0-9 <>_&-]/` },
				model: 'project',
			},
			{
				entityType: 'keywords',
				entities: '',
				has_entities: false,
				validation: { regex: `/[^A-Za-z0-9 <>_&-]/` },
				model: 'project',
			},
			{
				entityType: 'tasks',
				entities: '',
				has_entities: false,
				validation: null,
				model: 'project',
			},
			{
				entityType: 'learning_resources',
				entities: '',
				has_entities: false,
				validation: { regex: `/^(?!-)[A-Za-z0-9-]+([-.]{1}[a-z0-9]+)*.[A-Za-z]{2,6}$/` },
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

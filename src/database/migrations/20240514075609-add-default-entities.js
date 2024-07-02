/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const entitiesArray = {
			resources: [
				{
					value: 'projects',
					label: 'Project',
				},
				{
					value: 'observations',
					label: 'Observation',
				},
				{
					value: 'observation_with_rubrics',
					label: 'Observation with rubric',
				},
				{
					value: 'surveys',
					label: 'Survey',
				},
				{
					value: 'programs',
					label: 'Program',
				},
			],
			categories: [
				{
					value: 'teachers',
					label: 'Teachers',
				},
				{
					value: 'students',
					label: 'Students',
				},
				{
					value: 'community',
					label: 'Community',
				},
				{
					value: 'schoolProcess',
					label: 'School Process',
				},
				{
					value: 'infrastructure',
					label: 'Infrastructure',
				},
				{
					value: 'educationLeader',
					label: 'Education Leader',
				},
				{
					value: 'other',
					label: 'Other',
				},
			],
			recommended_for: [
				{
					value: 'hm',
					label: 'HM',
				},
				{
					value: 'ht',
					label: 'HT',
				},
				{
					value: 'teachers',
					label: 'Teachers',
				},
				{
					value: 'educationLeader',
					label: 'Education Leader',
				},
			],
			languages: [
				{
					value: 'en',
					label: 'English',
				},
				{
					value: 'hi',
					label: 'Hindi',
				},
			],
			licenses: [
				{
					value: 'cc_by_4.0',
					label: 'CC BY 4.0',
				},
				{
					value: 'cc_by_nc',
					label: 'CC BY NC',
				},
				{
					value: 'cc_by_nc_nd',
					label: 'CC BY NC ND',
				},
				{
					value: 'cc_by_nd',
					label: 'CC BY ND',
				},
				{
					value: 'cc_by_sa',
					label: 'CC BY SA',
				},
				{
					value: 'cc_by_nc_sa',
					label: 'CC BY NC SA',
				},
			],
			title: '',
			objective: '',
			keywords: '',
			tasks: '',
		}

		const entityTypeFinalArray = Object.keys(entitiesArray).map((key) => {
			const value = entitiesArray[key]
			const hasEntities = Array.isArray(value) ? value.some((item) => item.value !== '') : value !== ''
			const entityTypeRow = {
				value: key,
				label: convertToWords(key),
				data_type: 'ARRAY[STRING]',
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
				created_by: 0,
				updated_by: 0,
				allow_filtering: false,
				organization_id: defaultOrgId,
				has_entities: hasEntities,
				allow_custom_entities: false,
			}

			return entityTypeRow
		})

		await queryInterface.bulkInsert('entity_types', entityTypeFinalArray, {})

		const entityTypes = await queryInterface.sequelize.query('SELECT * FROM entity_types', {
			type: queryInterface.sequelize.QueryTypes.SELECT,
		})
		const entityModelMapping = []
		entityTypes.forEach((entityType) => {
			let modelMappingData = {
				entity_type_id: entityType.id,
				model: 'project',
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
			}
			entityModelMapping.push(modelMappingData)
		})
		await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})
		const entityType = entityTypes.filter((entity) => entity.has_entities)
		const entitiesFinalArray = []

		entityType.forEach((eachType) => {
			if (eachType.value in entitiesArray) {
				entitiesArray[eachType.value].forEach((eachEntity) => {
					eachEntity.entity_type_id = eachType.id
					eachEntity.type = 'SYSTEM'
					eachEntity.status = 'ACTIVE'
					eachEntity.created_at = new Date()
					eachEntity.updated_at = new Date()
					eachEntity.created_by = 0

					entitiesFinalArray.push(eachEntity)
				})
			}
		})

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

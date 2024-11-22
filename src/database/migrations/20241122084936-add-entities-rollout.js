/** @type {import('sequelize-cli').Migration} */

module.exports = {
	async up(queryInterface, Sequelize) {
		try {
			const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
			if (!defaultOrgId) {
				throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
			}

			const entitiesArray = [
				{
					entityType: 'location',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
				},
				{
					entityType: 'role',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
				},
				{
					entityType: 'gender',
					entities: [
						{ value: 'male', label: 'male' },
						{ value: 'female', label: 'female' },
						{ value: 'other', label: 'other' },
					],
					has_entities: true,
					is_external: false,
					validation: {},
				},
			]

			const entityTypeFinalArray = entitiesArray.map((entity) => {
				const { entityType, has_entities, validation, is_external } = entity
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
					is_external,
					allow_custom_entities: false,
					validations: validation ? JSON.stringify(validation) : null,
				}
			})
			await queryInterface.bulkInsert('entity_types', entityTypeFinalArray, {})

			const entityTypes = await queryInterface.sequelize.query('SELECT * FROM entity_types', {
				type: queryInterface.sequelize.QueryTypes.SELECT,
			})

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
		const entityTypesList = ['location', 'role', 'gender']
		const entityTypes = await queryInterface.sequelize.query(
			`SELECT id FROM entity_types WHERE value IN (:entityTypesList)`,
			{
				replacements: { entityTypesList },
				type: queryInterface.sequelize.QueryTypes.SELECT,
			}
		)
		const entityTypeIdsToDelete = await entityTypes.map((entityType) => entityType.id)

		await queryInterface.bulkDelete('entities', { entity_type_id: entityTypeIdsToDelete }, {})
		await queryInterface.bulkDelete('entity_types', { id: entityTypeIdsToDelete }, {})
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

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
					entityType: 'state',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
					model: ['targeting'],
					api: {
						service: 'entity-management',
						endPointService: 'v1/entities/find',
						pathParam: '',
						queryParam: '',
					},
				},
				{
					entityType: 'district',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
					model: ['targeting'],
					api: {
						service: 'entity-management',
						endPointService: 'v1/entities/find',
						pathParam: '',
						queryParam: '',
					},
				},
				{
					entityType: 'block',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
					model: ['targeting'],
					api: {
						service: 'entity-management',
						endPointService: 'v1/entities/find',
						pathParam: '',
						queryParam: '',
					},
				},
				{
					entityType: 'cluster',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
					model: ['targeting'],
					api: {
						service: 'entity-management',
						endPointService: 'v1/entities/find',
						pathParam: '',
						queryParam: '',
					},
				},
				{
					entityType: 'school',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
					model: ['targeting'],
					api: {
						service: 'entity-management',
						endPointService: 'v1/entities/find',
						pathParam: '',
						queryParam: '',
					},
				},
				{
					entityType: 'professional_role',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
					model: ['targeting'],
					api: {
						service: 'entity-management',
						endPointService: 'v1/entities/find',
						pathParam: '',
						queryParam: '',
					},
				},
				{
					entityType: 'professional_subroles',
					entities: '',
					has_entities: true,
					is_external: true,
					validation: {},
					depended_on: 'professional_role',
					model: ['targeting'],
					api: {
						service: 'entity-management',
						endPointService: 'v1/entities/find',
						pathParam: '',
						queryParam: '',
					},
				},
			]
			const entityTypesList = entitiesArray.map((entity) => entity.entityType)

			const entityTypeFinalArray = entitiesArray.map((entity) => {
				const { entityType, has_entities, validation } = entity
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

			const entityTypes = await queryInterface.sequelize.query(
				'SELECT * FROM entity_types WHERE value IN (:entityTypesList) AND organization_code = :organization_code AND tenant_code = :tenant_code',
				{
					replacements: { entityTypesList, tenant_code: defaultTenantCode, organization_code: defaultOrgId },
					type: queryInterface.sequelize.QueryTypes.SELECT,
				}
			)

			entitiesArray.forEach(async (eachEntityType) => {
				if (
					(eachEntityType.hasOwnProperty('depended_on') && eachEntityType['depended_on'] != '') ||
					(eachEntityType.hasOwnProperty('is_external') && eachEntityType['is_external'] != '')
				) {
					let dependent_entity_type = {}
					if (eachEntityType.hasOwnProperty('depended_on') && eachEntityType['depended_on']) {
						dependent_entity_type = entityTypes.find(
							(entityType) => entityType.value == eachEntityType['depended_on']
						)
					}
					const config = {
						is_external: eachEntityType?.is_external ? true : false,
						is_dependent: eachEntityType.hasOwnProperty('depended_on'),
						depended_on: dependent_entity_type.id ? dependent_entity_type.id : null,
						api: eachEntityType?.api || {},
					}
					await queryInterface.bulkUpdate(
						'entity_types',
						{ config },
						{
							value: eachEntityType.entityType,
							organization_code: defaultOrgId,
							tenant_code: defaultTenantCode,
						}
					)
				}
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
							tenant_code: defaultTenantCode,
							organization_code: defaultOrgId,
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
			if (entitiesFinalArray.length > 0) {
				await queryInterface.bulkInsert('entities', entitiesFinalArray, {})
			}

			await queryInterface.bulkInsert(
				'modules',
				[
					{
						code: 'targeting',
						status: 'ACTIVE',
						created_at: new Date(),
						updated_at: new Date(),
					},
				],
				{}
			)
			const entityModelMapping = entityTypes.reduce((acc, eachType) => {
				const entityData = entitiesArray.find((entity) => entity.entityType === eachType.value)
				if (entityData && entityData.model && Array.isArray(entityData?.model) && entityData.model.length > 0) {
					return acc.concat(
						entityData.model.map((model) => ({
							entity_type_id: eachType.id,
							tenant_code: defaultTenantCode,
							organization_code: defaultOrgId,
							model,
							status: 'ACTIVE',
							created_at: new Date(),
							updated_at: new Date(),
						}))
					)
				}
				return acc
			}, [])
			if (entityModelMapping.length > 0) {
				await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})
			}
		} catch (error) {
			console.error('ERR : : ', error)
			throw error
		}
	},

	async down(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
		if (!defaultTenantCode) {
			throw new Error('DEFAULT_TENANT_CODE environment variable is undefined. Please make sure it is set.')
		}
		const entityTypesList = [
			'state',
			'district',
			'block',
			'cluster',
			'school',
			'professional_role',
			'professional_subroles',
		]
		const entityTypes = await queryInterface.sequelize.query(
			`SELECT id FROM entity_types WHERE value IN (:entityTypesList) AND organization_code = :organization_code AND tenant_code = :tenant_code`,
			{
				replacements: { entityTypesList, tenant_code: defaultTenantCode, organization_code: defaultOrgId },
				type: queryInterface.sequelize.QueryTypes.SELECT,
			}
		)

		const entityTypeIdsToDelete = await entityTypes.map((entityType) => entityType.id)

		await queryInterface.bulkDelete('entities', { entity_type_id: entityTypeIdsToDelete }, {})
		await queryInterface.bulkDelete('entity_types', { id: entityTypeIdsToDelete }, {})
		await queryInterface.bulkDelete('modules', { code: 'targeting' }, {})
		await queryInterface.bulkDelete('entities_model_mapping', { entity_type_id: entityTypeIdsToDelete }, {})
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

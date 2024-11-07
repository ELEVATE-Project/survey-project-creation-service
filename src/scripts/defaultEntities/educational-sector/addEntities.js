/**
 * name : addEntities.js
 * author : Adithya Dinesh
 * created-date : 07-Nov-2024
 * Description : script to upload default entities related to education industry.
 */
require('module-alias/register')
const entityTypeQueries = require('../../../database/queries/entityType')
require('dotenv').config({ path: '../../../.env' })
const defaultOrgId = process.env.DEFAULT_ORG_ID
const { Op } = require('sequelize')
const entitiesQueries = require('../../../database/queries/entities')
// create entity Type entities mapping here.
// replicate the same code by changing the values for other domains other than education.
// add more in the below variable.
const entityTypeEntitiesMapping = {
	recommended_for: [
		{ value: 'hm', label: 'HM' },
		{ value: 'ht', label: 'HT' },
		{ value: 'teachers', label: 'Teachers' },
		{ value: 'education_leader', label: 'Education Leader' },
	],
	categories: [
		{ value: 'hm', label: 'HM' },
		{ value: 'ht', label: 'HT' },
		{ value: 'teachers', label: 'Teachers' },
		{ value: 'education_leader', label: 'Education Leader' },
	],
}

;(async () => {
	try {
		// const defaultOrgId = process.env.DEFAULT_ORG_ID
		const entityTypes = Object.keys(entityTypeEntitiesMapping)

		const entityTypeDetails = await entityTypeQueries.findAllEntityTypes(defaultOrgId, ['id', 'value'], {
			value: {
				[Op.in]: entityTypes,
			},
		})
		const entityTypeIdValueMap = entityTypeDetails.reduce((idValueMap, entityType) => {
			idValueMap[Number(entityType.id)] = entityTypeEntitiesMapping[entityType.value]
			return idValueMap
		}, {})
		let create = []
		let entityTypeIds = Object.keys(entityTypeIdValueMap)

		const existingEntities = await entitiesQueries.findAllEntities({
			entity_type_id: {
				[Op.in]: entityTypeIds,
			},
		})
		Object.entries(entityTypeIdValueMap).forEach(([entity_type_id, entities]) => {
			entityTypeIds.push(entity_type_id)

			entities.forEach((entity) => {
				const exists = existingEntities.some(
					(existingEntity) =>
						existingEntity.entity_type_id === Number(entity_type_id) &&
						existingEntity.value === entity.value
				)

				// Only push to create if the entity does not exist in existingEntities
				if (!exists) {
					create.push({
						entity_type_id: Number(entity_type_id),
						value: entity.value,
						label: entity.label,
						status: 'ACTIVE',
						type: 'SYSTEM',
						created_by: '0',
						updated_by: '0',
						created_at: new Date(),
						updated_at: new Date(),
					})
				}
			})
		})

		if (create.length > 0) {
			await entitiesQueries.bulkCreate(create)
			console.log('-----> Entities Created Successfully.')
		} else {
			console.log('-----> All Entities already Created.')
		}
	} catch (error) {
		console.log(error)
	}
})().catch((err) => console.error(err))

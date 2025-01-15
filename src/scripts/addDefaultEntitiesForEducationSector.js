/**
 * name : addDefaultEntitiesForEducationSector.js
 * author : Adithya Dinesh
 * created-date : 07-Nov-2024
 * Description : script to upload default entities related to education industry.
 */
require('module-alias/register')
require('dotenv').config({ path: '../.env' })
const entityTypeQueries = require('../database/queries/entityType')
const defaultOrgId = process.env.DEFAULT_ORG_ID
	? process.env.DEFAULT_ORG_ID.toString()
	: (() => {
			throw new Error('DEFAULT_ORG_ID is not defined in env')
	  })()
const { Op } = require('sequelize')
const entitiesQueries = require('../database/queries/entities')

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
		// fetch the entity types to add entities
		const entityTypes = Object.keys(entityTypeEntitiesMapping)
		// fetch entity type and its current entities
		const entityTypeDetails = await entityTypeQueries.findUserEntityTypeAndEntities({
			value: {
				[Op.in]: entityTypes,
			},
		})
		let existingEntities = []
		// create entity id map
		const entityTypeIdValueMap = Object.fromEntries(
			entityTypeDetails.map((entityType) => {
				const id = Number(entityType.id)

				// Populate existingEntities inline using flatMap for efficiency
				existingEntities.push(
					...entityType.entities.map((entity) => ({
						entity_type_id: id,
						value: entity.value,
					}))
				)

				return [id, entityTypeEntitiesMapping[entityType.value]]
			})
		)

		let entitiesToCreate = [] // all the entities to create will be pushed to this variable

		Object.entries(entityTypeIdValueMap).forEach(([entity_type_id, entities]) => {
			// iterate through the entities given and check if its already created for the entity type
			entities.forEach((entity) => {
				const exists = existingEntities.some(
					(existingEntity) =>
						existingEntity.entity_type_id === Number(entity_type_id) &&
						existingEntity.value === entity.value
				)

				// Only push to create if the entity does not exist in existingEntities
				if (!exists) {
					entitiesToCreate.push({
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

		if (entitiesToCreate.length > 0) {
			// bulk create entities
			await entitiesQueries.bulkCreate(entitiesToCreate)
			console.log('-----> Entities Created Successfully.')
		} else {
			console.log('-----> All Entities already Created.')
		}
	} catch (error) {
		console.log(error)
	}
})().catch((err) => console.error(err))

'use strict'

const EntityModelMapping = require('../models/index').EntityModelMapping
const EntityType = require('../models/index').EntityType
const common = require('@constants/common')
const entityTypeQueries = require('@database/queries/entityType')
const { getDefaultOrgId } = require('@helpers/getDefaultOrgId')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const { Op } = require('sequelize')

const entityQueries = require('@database/queries/entities')
exports.create = async (data) => {
	try {
		return await EntityModelMapping.create(data)
	} catch (error) {
		throw error
	}
}

exports.findEntityTypesAndEntities = async (filter, userDetails, attributes = {}) => {
	try {
		const defaultOrgId = await getDefaultOrgId()
		if (!defaultOrgId)
			return responses.failureResponse({
				message: 'DEFAULT_ORG_ID_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})

		const entityModelMappingData = await EntityModelMapping.findAll({
			where: filter,
			raw: true,
		})
		const entityTypeIds = entityModelMappingData.map((entityModelMapping) => entityModelMapping.entity_type_id)

		const filters = {
			id: entityTypeIds,
			status: common.STATUS_ACTIVE,
			organization_id: {
				[Op.in]: [userDetails.organization_id, defaultOrgId],
			},
		}
		const EntityTypes = await EntityType.findAll({
			where: filters,
			raw: true,
			attributes: attributes,
		})
		const prunedEntities = removeDefaultOrgEntityTypes(EntityTypes, userDetails.organization_id)

		let reletedEntityTypeIds = prunedEntities
			.filter((entityType) => entityType.has_entities)
			.map((entityType) => entityType.id)
		if (reletedEntityTypeIds.length > 0) {
			let filter = {
				[Op.or]: [
					{
						entity_type_id: reletedEntityTypeIds,
						created_by: common.CREATED_BY_SYSTEM,
						status: common.STATUS_ACTIVE,
					},
					{ id: reletedEntityTypeIds, created_by: userDetails.id, status: common.STATUS_ACTIVE },
				],
			}
			let entities = await entityQueries.findAllEntities(filter)

			const result = prunedEntities.map((entityType) => {
				const relatedEntities = entities.filter((entity) => entity.entity_type_id === entityType.id)
				return { ...entityType, entities: relatedEntities }
			})
			return result
		}

		return prunedEntities
	} catch (error) {
		throw error
	}
}

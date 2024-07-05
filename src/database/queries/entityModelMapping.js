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
exports.create = async (data) => {
	try {
		return await EntityModelMapping.create(data)
	} catch (error) {
		throw error
	}
}

exports.findEntityTypes = async (filter, orgId, attributes = {}) => {
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
				[Op.in]: [orgId, defaultOrgId],
			},
		}
		const EntityTypes = await EntityType.findAll({
			where: filters,
			raw: true,
			attributes: attributes,
		})
		const prunedEntities = removeDefaultOrgEntityTypes(EntityTypes, orgId)

		return prunedEntities
	} catch (error) {
		throw error
	}
}

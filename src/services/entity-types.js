// DependenciesI
const httpStatusCode = require('@generics/http-status')
const { UniqueConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const { getDefaultOrgId } = require('@helpers/getDefaultOrgId')
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const entityTypeQueries = require('@database/queries/entityType')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const common = require('@constants/common')
module.exports = class EntityTypeHelper {
	/**
	 * Create entity type.
	 * @method
	 * @name create
	 * @param {Object} bodyData - entity type body data.
	 * @param {String} id -  id.
	 * @returns {JSON} - Created entity type response.
	 */

	static async create(bodyData, loggedInUserId, orgId) {
		try {
			bodyData.created_by = loggedInUserId
			bodyData.updated_by = loggedInUserId
			bodyData.organization_id = orgId
			bodyData.value = bodyData.value.toLowerCase()
			let entityType = await entityTypeQueries.createEntityType(bodyData)

			if (entityType) {
				if (bodyData.model) {
					let entityModelMapping = {
						entity_type_id: entityType.dataValues.id,
						model: bodyData.model,
						status: common.STATUS_ACTIVE,
					}
					await entityModelMappingQuery.create(entityModelMapping)
				}
				return responses.successResponse({
					statusCode: httpStatusCode.created,
					message: 'ENTITY_TYPE_CREATED_SUCCESSFULLY',
					result: entityType,
				})
			}
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update entity type.
	 * @method
	 * @name update
	 * @param {Object} bodyData -  body data.
	 * @param {String} id - entity type id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @returns {JSON} - Updated Entity Type.
	 */

	static async update(id, bodyData, loggedInUserId, orgId) {
		try {
			bodyData.updated_by = loggedInUserId
			if (bodyData.value) bodyData.value = bodyData.value.toLowerCase()
			const [updateCount, updatedEntityType] = await entityTypeQueries.updateOneEntityType(id, orgId, bodyData, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_TYPE_UPDATED_SUCCESSFULLY',
				result: updatedEntityType,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	static async readAllSystemEntityTypes(orgId) {
		try {
			const attributes = ['value', 'label', 'id']

			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const entities = await entityTypeQueries.findAllEntityTypes([orgId, defaultOrgId], attributes)

			if (!entities.length) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
				result: entities,
			})
		} catch (error) {
			throw error
		}
	}

	static async readUserEntityTypes(body, userId, orgId) {
		try {
			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const filter = {
				value: body.value,
				status: common.STATUS_ACTIVE,
				organization_id: {
					[Op.in]: [orgId, defaultOrgId],
				},
			}
			const entityTypes = await entityTypeQueries.findUserEntityTypeAndEntities(filter)

			const prunedEntities = removeDefaultOrgEntityTypes(entityTypes, orgId)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
				result: { entity_types: prunedEntities },
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}
	/**
	 * Delete entity type.
	 * @method
	 * @name delete
	 * @param {String} id - Delete entity type.
	 * @returns {JSON} - Entity deleted response.
	 */

	static async delete(id, organizationId) {
		try {
			const deleteCount = await entityTypeQueries.deleteOneEntityType(id, organizationId)
			if (deleteCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_TYPE_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * @description 							- process data to add value and labels in case of entity type
	 * @method
	 * @name processEntityTypesToAddValueLabels
	 * @param {Array} responseData 				- data to modify
	 * @param {Array} orgIds 					- org ids
	 * @param {String} modelName 				- model name which the entity search is assocoated to.
	 * @param {String} orgIdKey 				- In responseData which key represents org id
	 * @returns {JSON} 							- modified response data
	 */
	static async processEntityTypesToAddValueLabels(responseData, orgIds, modelName, orgIdKey) {
		try {
			const defaultOrgId = await getDefaultOrgId()
			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			if (!orgIds.includes(defaultOrgId)) {
				orgIds.push(defaultOrgId)
			}

			const filter = {
				status: common.STATUS_ACTIVE,
				has_entities: true,
				organization_id: {
					[Op.in]: orgIds,
				},
				model_names: {
					[Op.contains]: Array.isArray(modelName) ? modelName : [modelName],
				},
			}

			// get entityTypes with entities data
			let entityTypesWithEntities = await entityTypeQueries.findUserEntityTypesAndEntities(filter)
			entityTypesWithEntities = JSON.parse(JSON.stringify(entityTypesWithEntities))
			if (!entityTypesWithEntities.length > 0) {
				return responseData
			}

			// Use Array.map with async to process each element asynchronously
			const result = responseData.map(async (element) => {
				// Prepare the array of orgIds to search
				const orgIdToSearch = [element[orgIdKey], defaultOrgId]

				// Filter entity types based on orgIds and remove parent entity types
				let entityTypeData = entityTypesWithEntities.filter((obj) =>
					orgIdToSearch.includes(obj.organization_id)
				)
				entityTypeData = utils.removeParentEntityTypes(entityTypeData)

				// Process the data asynchronously to add value labels
				const processDbResponse = await utils.processDbResponse(element, entityTypeData)

				// Return the processed result
				return processDbResponse
			})
			return Promise.all(result)
		} catch (err) {
			return err
		}
	}
}

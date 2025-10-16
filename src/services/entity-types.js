// Dependencies
const httpStatusCode = require('@generics/http-status')
const { UniqueConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const defaultOrgId = process.env.DEFAULT_ORGANIZATION_CODE
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const entityTypeQueries = require('@database/queries/entityType')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const common = require('@constants/common')
const interfaceRequests = require('@requests/interface')
module.exports = class EntityTypeHelper {
	/**
	 * Create entity type.
	 * @method
	 * @name create
	 * @param {Object} bodyData - entity type body data.
	 * @param {String} id -  id.
	 * @returns {JSON} - Created entity type response.
	 */

	static async create(bodyData, loggedInUserId, orgCode, tenantCode) {
		let entityTypeId
		try {
			bodyData.created_by = loggedInUserId
			bodyData.updated_by = loggedInUserId
			bodyData.organization_code = orgCode
			bodyData.tenant_code = tenantCode
			bodyData.value = bodyData.value.toLowerCase()
			bodyData.config = {}
			if (bodyData?.is_external) {
				bodyData.config = {
					is_external: bodyData?.is_external ? true : false,
				}
			}

			if (bodyData?.depended_on) {
				const checkDependedEntityType = await entityTypeQueries.findOneEntityType({
					id: bodyData.depended_on,
					organization_code: orgCode,
				})

				if (!checkDependedEntityType.id) {
					return responses.failureResponse({
						message: 'DEPENDED_ENTITY_TYPE_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				bodyData.config.depended_on = bodyData.depended_on
				bodyData.config.is_dependent = bodyData.depended_on ? true : false
			}
			delete bodyData.depended_on
			delete bodyData.is_external
			delete bodyData.is_dependent
			let entityType = await entityTypeQueries.createEntityType(bodyData)
			if (!entityType?.id) {
				throw {
					message: 'ENTITY_TYPE_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
				}
			}
			entityTypeId = entityType.id
			if (entityType && bodyData.model) {
				let entityModelMapping = {
					entity_type_id: entityTypeId,
					model: bodyData.model,
					tenant_code: tenantCode,
					organization_code: orgCode,
					status: common.STATUS_ACTIVE,
				}
				await entityModelMappingQuery.create(entityModelMapping)
			}
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ENTITY_TYPE_CREATED_SUCCESSFULLY',
				result: entityType,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Update entity type.
	 * @method
	 * @name update
	 * @param {Object} bodyData -  body data.
	 * @param {String} id - entity type id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @param {String} orgCode - logged in user orgCode.
	 * @param {String} tenantCode - logged in user tenantCode.
	 * @returns {JSON} - Updated Entity Type.
	 */

	static async update(id, bodyData, loggedInUserId, orgCode, tenantCode) {
		try {
			bodyData.updated_by = loggedInUserId
			if (bodyData.value) bodyData.value = bodyData.value.toLowerCase()

			if ('is_external' in bodyData && bodyData.is_external !== '') {
				bodyData.config = {
					is_external: bodyData.is_external ? true : false,
				}
			}

			if ('depended_on' in bodyData && bodyData.depended_on !== '') {
				const checkDependedEntityType = await entityTypeQueries.findOneEntityType({
					id: bodyData.depended_on,
					organization_code: orgCode,
					tenant_code: tenantCode,
				})

				if (!checkDependedEntityType.id) {
					return responses.failureResponse({
						message: 'DEPENDED_ENTITY_TYPE_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				bodyData.config.depended_on = bodyData.depended_on
				bodyData.config.is_dependent = bodyData.depended_on ? true : false
			}

			delete bodyData.depended_on
			delete bodyData.is_external
			delete bodyData.is_dependent

			const [updateCount, updatedEntityType] = await entityTypeQueries.updateOneEntityType(
				id,
				orgCode,
				tenantCode,
				bodyData,
				{
					returning: true,
					raw: true,
				}
			)

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
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	static async readAllSystemEntityTypes(orgCode, tenantCode) {
		try {
			const attributes = ['value', 'label', 'id', 'organization_code']

			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const entities = await entityTypeQueries.findAllEntityTypes([orgCode, defaultOrgId], tenantCode, attributes)

			const prunedEntities = removeDefaultOrgEntityTypes(entities, orgCode).map((entityType) => {
				return {
					id: entityType.id,
					label: entityType.label,
					value: entityType.value,
				}
			})

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
				result: prunedEntities,
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	static async readUserEntityTypes(body, userId, orgCode, tenantCode) {
		try {
			if (!defaultOrgId)
				return responses.failureResponse({
					message: 'DEFAULT_ORG_ID_NOT_SET',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const filter = {
				value: body.value,
				status: common.STATUS_ACTIVE,
				tenant_code: tenantCode,
				organization_code: {
					[Op.in]: [orgCode, defaultOrgId],
				},
			}

			const entityTypes = await entityTypeQueries.findUserEntityTypeAndEntities(filter)

			const prunedEntities = removeDefaultOrgEntityTypes(entityTypes, orgCode)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
				result: { entity_types: prunedEntities },
			})
		} catch (error) {
			console.log(error)
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
	/**
	 * Delete entity type.
	 * @method
	 * @name delete
	 * @param {String} id - Delete entity type.
	 * @returns {JSON} - Entity deleted response.
	 */

	static async delete(id, orgCode, tenantCode) {
		try {
			const deleteCount = await entityTypeQueries.deleteOneEntityType(id, orgCode, tenantCode)
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
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
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
				organization_code: {
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
					orgIdToSearch.includes(obj.organization_code)
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

	/**
	 * Read entity types from external service
	 * @method
	 * @name subEntityTypes
	 * @param {Object} bodyData - Request body data
	 * @param {String} token - User token
	 * @returns {JSON} - Entity types response
	 */
	static async subEntityTypes(organization_code, tenant_code, token) {
		try {
			const result = await interfaceRequests.entityDbFind(organization_code, tenant_code, token)

			if (!result.success) {
				return responses.failureResponse({
					message: 'FAILED_TO_FETCH_ENTITY_TYPES',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPES_FETCHED_SUCCESSFULLY',
				result: result?.data?.result || [],
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || 'ENTITY_TYPES_READ_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

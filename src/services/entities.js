// Dependencies
const httpStatusCode = require('@generics/http-status')
const entityQueries = require('@database/queries/entities')
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const responses = require('@helpers/responses')
const common = require('@constants/common')

module.exports = class EntityHelper {
	/**
	 * Create entity.
	 * @method
	 * @name create
	 * @param {Object} bodyData - entity body data.
	 * @param {String} id -  id.
	 * @returns {JSON} - Entity created response.
	 */

	static async create(bodyData, loggedInUserId) {
		bodyData.created_by = loggedInUserId
		bodyData.updated_by = loggedInUserId
		bodyData.value = bodyData.value.toLowerCase()
		try {
			const checkEntity = await entityQueries.findOne({
				entity_type_id: bodyData.entity_type_id,
				value: bodyData.value,
			})
			if (checkEntity) {
				return responses.failureResponse({
					message: 'ENTITY_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			const entity = await entityQueries.createEntity(bodyData)
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'ENTITY_CREATED_SUCCESSFULLY',
				result: entity,
			})
		} catch (error) {
			console.log('-=-=-=-=-=-=-=>>>> ERROR : ', error)
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			if (error instanceof ForeignKeyConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_TYPE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update entity.
	 * @method
	 * @name update
	 * @param {Object} bodyData - entity body data.
	 * @param {String} _id - entity id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @returns {JSON} - Entity updated response.
	 */

	static async update(bodyData, id, loggedInUserId) {
		bodyData.updated_by = loggedInUserId
		try {
			if (bodyData.value) bodyData.value = bodyData.value.toLowerCase()
			const [updateCount, updatedEntity] = await entityQueries.updateOneEntity(id, bodyData, loggedInUserId, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_UPDATED_SUCCESSFULLY',
				result: updatedEntity,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ENTITY_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Read entity.
	 * @method
	 * @name read
	 * @param {Object} bodyData - entity body data.
	 * @returns {JSON} - Entity read response.
	 */

	static async read(query, userId) {
		try {
			let filter
			if (query.id) {
				filter = {
					[Op.or]: [
						{
							id: query.id,
							created_by: common.CREATED_BY_SYSTEM,
							status: common.STATUS_ACTIVE,
						},
						{ id: query.id, created_by: userId, status: common.STATUS_ACTIVE },
					],
				}
			} else {
				filter = {
					[Op.or]: [
						{
							value: query.value,
							created_by: common.CREATED_BY_SYSTEM,
							status: common.STATUS_ACTIVE,
						},
						{ value: query.value, created_by: userId, status: common.STATUS_ACTIVE },
					],
				}
			}
			const entities = await entityQueries.findAllEntities(filter)

			if (!entities.length) {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_FETCHED_SUCCESSFULLY',
				result: entities,
			})
		} catch (error) {
			throw error
		}
	}

	static async readAll(query, userId) {
		try {
			let filter
			if (query.read_user_entity == true) {
				filter = {
					[Op.or]: [
						{
							created_by: common.CREATED_BY_SYSTEM,
						},
						{
							created_by: userId,
						},
					],
				}
			} else {
				filter = {
					created_by: common.CREATED_BY_SYSTEM,
				}
			}
			const entities = await entityQueries.findAllEntities(filter)

			if (!entities.length) {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_FETCHED_SUCCESSFULLY',
				result: entities,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Delete entity.
	 * @method
	 * @name delete
	 * @param {String} _id - Delete entity.
	 * @returns {JSON} - Entity deleted response.
	 */

	static async delete(id, userId) {
		try {
			const deleteCount = await entityQueries.deleteOneEntityType(id, userId)
			if (deleteCount === 0) {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ENTITY_DELETED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get list of entity
	 * @method
	 * @name list
	 * @param {Object} query - query params
	 * @param {String} userId - logged in user id.
	 * @param {String} searchText - search label in entity.
	 * @param {Integer} page -  page no.
	 * @param {Integer} pageSize -  page limit per api.
	 * @returns {JSON} - Entity search matched response.
	 */
	static async list(query, searchText, pageNo, pageSize) {
		try {
			let entityType = query.entity_type_id ? query.entity_type_id : ''
			let filter = {}
			if (entityType) {
				filter['entity_type_id'] = entityType
			}

			const attributes = ['id', 'entity_type_id', 'value', 'label', 'status', 'type', 'created_by', 'created_at']
			const entities = await entityQueries.getAllEntities(filter, attributes, pageNo, pageSize, searchText)

			if (entities.rows == 0 || entities.count == 0) {
				return responses.failureResponse({
					message: 'ENTITY_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				const results = {
					data: entities.rows,
					count: entities.count,
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ENTITY_FETCHED_SUCCESSFULLY',
					result: results,
				})
			}
		} catch (error) {
			throw error
		}
	}
}

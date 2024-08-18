/**
 * name : services/actions.js
 * author : Priyanka Pradeep
 * Date : 13-Aug-2024
 * Description : Activities Service
 */
const httpStatusCode = require('@generics/http-status')
const actionQueries = require('@database/queries/actions')
const responses = require('@helpers/responses')
const { UniqueConstraintError } = require('sequelize')
const common = require('@constants/common')
const { Op } = require('sequelize')
module.exports = class ActionsHelper {
	/**
	 * Create Action
	 * @method
	 * @name create
	 * @param {String} bodyData - action creation data
	 * @returns {JSON} - action creation response
	 */
	static async create(bodyData) {
		try {
			const action = await actionQueries.findOne({ code: bodyData.code })
			if (action?.id) {
				throw new Error('ACTION_ALREADY_EXISTS')
			}

			const createAction = await actionQueries.create(bodyData)
			if (!createAction?.id) {
				throw new Error('ACTION_CREATION_FAILED')
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ACTION_CREATED',
				result: createAction,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ACTION_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				return responses.failureResponse({
					message: error.message || error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
		}
	}

	/**
	 * Update Action
	 * @method
	 * @name update
	 * @param {Integer} id - Action Id
	 * @param {String} bodyData - action data to be updated
	 * @returns {JSON} - action update response
	 */
	static async update(id, bodyData) {
		try {
			const [updateCount, updatedAction] = await actionQueries.updateOne({ id: id }, bodyData, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				throw new Error('ACTION_NOT_FOUND')
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ACTION_UPDATED',
				result: updatedAction[0],
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'ACTION_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				return responses.failureResponse({
					message: error.message || error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
		}
	}

	/**
	 * list actions.
	 * @method
	 * @name list
	 * @param {String} id -  id.
	 * @returns {JSON} - actions list response.
	 */

	static async list(page, limit, search) {
		try {
			let result = {
				data: [],
				count: 0,
			}
			const offset = common.getPaginationOffset(page, limit)

			const filter = {
				code: { [Op.iLike]: `%${search}%` },
			}
			const options = {
				offset,
				limit,
			}
			const attributes = ['id', 'code', 'status']
			const actions = await actionQueries.findAllActions(filter, attributes, options)

			if (actions.count <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ACTIONS_FETCHED',
					result: result,
				})
			}

			result.data = actions.rows
			result.count = actions.count

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ACTIONS_FETCHED',
				result: result,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Delete actions.
	 * @method
	 * @name delete
	 * @param {String} id - action id.
	 * @returns {JSON} - action deleted response.
	 */

	static async delete(id) {
		try {
			const action = await actionQueries.findById(id)
			if (!action) {
				throw new Error('ACTION_NOT_FOUND')
			} else {
				const deleteAction = await actionQueries.deleteAction(id)
				if (!deleteAction) {
					throw new Error('ACTION_NOT_DELETED')
				}
				return responses.successResponse({
					statusCode: httpStatusCode.accepted,
					message: 'ACTION_DELETED_SUCCESSFULLY',
				})
			}
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

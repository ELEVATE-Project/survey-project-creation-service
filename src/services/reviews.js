// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const reviewsQueries = require('@database/queries/reviews')
const responses = require('@helpers/responses')

module.exports = class reviewsHelper {
	/**
	 * Create Review.
	 * @method
	 * @name create
	 * @param {Object} bodyData - review body data.
	 * @param {String} id -  id.
	 * @returns {JSON} - review created response.
	 */

	static async create(bodyData) {
		try {
			const reviewExist = await reviewsQueries.findOne({})
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'MODULES_CREATED_SUCCESSFULLY',
				result: {
					Id: modules.id,
					code: modules.code,
					status: modules.status,
				},
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'MODULES_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update review.
	 * @method
	 * @name update
	 * @param {Object} bodyData - review body data.
	 * @param {String} _id - review id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @returns {JSON} - review updated response.
	 */

	static async update(id, bodyData) {
		try {
			const modules = await modulesQueries.findModulesById(id)
			if (!modules) {
				throw new Error('MODULES_NOT_FOUND')
			}

			const updatedModules = await modulesQueries.updateModules({ id }, bodyData)
			const updatePermissions = permissionsQueries.updatePermissions(
				{ module: modules.code },
				{ module: updatedModules.code }
			)

			if (!updatedModules && !updatePermissions) {
				return responses.failureResponse({
					message: 'MODULES_NOT_UPDATED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				return responses.successResponse({
					statusCode: httpStatusCode.created,
					message: 'MODULES_UPDATED_SUCCESSFULLY',
					result: {
						id: updatedModules.id,
						status: updatedModules.status,
						code: updatedModules.code,
					},
				})
			}
		} catch (error) {
			throw error
		}
	}
}

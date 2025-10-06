/**
 * name : services/review-stages.js
 * author : Priyanka Pradeep
 * Date : 29-July-2024
 * Description : Review Stage Service
 */
// Dependencies
const httpStatusCode = require('@generics/http-status')
const reviewStageQueries = require('@database/queries/reviewStage')
const responses = require('@helpers/responses')

module.exports = class reviewStagesHelper {
	/**
	 * update review stage
	 * @method
	 * @name update
	 * @param {Object} bodyData - review stage body data.
	 * @returns {JSON} - update review stage response.
	 */

	static async update(id, bodyData, organization_code, tenant_code) {
		try {
			bodyData.organization_code = organization_code
			bodyData.tenant_code = tenant_code
			//validate resource type
			const validResourceTypes = process.env.RESOURCE_TYPES.split(',')
			if (!validResourceTypes.includes(bodyData.resource_type)) {
				return responses.failureResponse({
					message: `resource_type ${bodyData.resource_type} is not a valid`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//update review stage
			const [updateCount, updatedReviewStage] = await reviewStageQueries.updateOne(
				{ id: id, tenant_code: tenant_code, organization_code: organization_code },
				bodyData,
				{
					returning: true,
					raw: true,
				}
			)

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'REVIEW_STAGE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_STAGE_UPDATED_SUCCESSFULLY',
				result: updatedReviewStage[0],
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
	 * list review stages
	 * @method
	 * @name list
	 * @param {String} resource_type - resource type
	 * @param {String} organization_code - organization id
	 * @returns {JSON} - list of review stages.
	 */

	static async list(resource_type, organization_code, tenant_code) {
		try {
			let result = {
				data: [],
				count: 0,
			}

			let filter = {
				organization_code,
				tenant_code
			}
			if (resource_type) {
				filter.resource_type = resource_type
			}

			const reviewStages = await reviewStageQueries.findAllReviewStages(filter)

			if (reviewStages.rows == 0 || reviewStages.count == 0) {
				return responses.successResponse({
					message: 'REVIEW_STAGES_FETCHED_SUCCESSFULLY',
					statusCode: httpStatusCode.ok,
					result,
				})
			} else {
				const results = {
					data: reviewStages.rows,
					count: reviewStages.count,
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REVIEW_STAGES_FETCHED_SUCCESSFULLY',
					result: { results },
				})
			}
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

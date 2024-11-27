/* eslint-disable no-useless-catch */
/**
 * name : services/reviews.js
 * author : Priyanka Pradeep
 * Date : 11-July-2024
 * Description : Review Stage Service
 */
// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const reviewsQueries = require('@database/queries/reviews')
const reviewResourceQueries = require('@database/queries/reviewResources')
const resourceQueries = require('@database/queries/resources')
const responses = require('@helpers/responses')
const orgExtensionService = require('@services/organization-extension')
const commentQueries = require('@database/queries/comments')
const _ = require('lodash')
const resourceService = require('@services/resource')
const { Op } = require('sequelize')
const utils = require('@generics/utils')
const resourceCreatorMappingQueries = require('@database/queries/resourcesCreatorMapping')
const kafkaCommunication = require('@generics/kafka-communication')
module.exports = class reviewsHelper {
	/**
	 * getDataManagers review.
	 * @method
	 * @name getDataManagers
	 * @param {String} orgId - organization id
	 * @returns {JSON} - get the list of data managers
	 */

	static async getDataManagers(orgId) {
		try {
			// Retrieve resource details based on the provided resourceId.
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'status', 'organization_id', 'type', 'next_stage', 'stage'] }
			)
			// If no resource is found return error
			if (!resource?.id) throw new Error('RESOURCE_NOT_FOUND')

			// Validate if there is an ongoing review for the given resourceId, userId, resource status, and orgId.
			let ongoingReview = await this.validateReview(resourceId, userId, resource.status, orgId)
			if (ongoingReview.statusCode !== httpStatusCode.ok) {
				return ongoingReview
			}

			const review = ongoingReview.result

			// if already requested for changes then throw error
			if (review.status === common.REVIEW_STATUS_REQUESTED_FOR_CHANGES)
				throw new Error('CHANGES_ALREADY_REQUESTED')

			// If the bodyData contains a comment Add or update comments
			if (bodyData.comment) {
				await handleComments(bodyData.comment, resourceId, userId, true)
			}

			// Update the status in the reviews table
			await reviewsQueries.update(
				{ id: review.id, organization_id: review.organization_id },
				{ status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES }
			)

			let resourceUpdateObj = {
				status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
				last_reviewed_on: new Date(),
			}

			// Update the 'last_reviewed_on' field in the resources table
			await resourceQueries.updateOne(
				{ organization_id: resource.organization_id, id: resourceId },
				resourceUpdateObj
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_CHANGES_REQUESTED',
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

// Export the handleComments function
module.exports.handleComments = handleComments

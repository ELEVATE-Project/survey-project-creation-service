// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const reviewsQueries = require('@database/queries/reviews')
const reviewResourceQueries = require('@database/queries/reviewResources')
const resourceQueries = require('@database/queries/resources')
const responses = require('@helpers/responses')
const configService = require('@services/config')
const commentQueries = require('@database/queries/comment')
const _ = require('lodash')

module.exports = class reviewsHelper {
	/**
	 * Update review.
	 * @method
	 * @name update
	 * @param {Object} bodyData - review body data.
	 * @param {String} _id - review id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @returns {JSON} - review updated response.
	 */

	static async update(resourceId, bodyData, loggedInUserId, orgId) {
		try {
			//validate resource
			const resource = await resourceQueries.findOne({ id: resource_id })
			if (!resource) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//validate resource status
			if (_notAllowedStatusForReview.includes(resource.status)) {
				return responses.failureResponse({
					message: `Resource is already ${resource.status}. You can't review it`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//Check if the logged-in user started the review
			const review = await reviewResourceQueries.findOne({
				resource_id: resourceId,
				reviewer_id: loggedInUserId,
			})

			// Fetch organization configuration
			const orgConfig = await configService.list(orgId)
			const orgConfigList = orgConfig.result.reduce((acc, item) => {
				acc[item.resource_type] = {
					review_type: item.review_type,
					min_approval: item.min_approval,
				}
				return acc
			}, {})

			// Extract review type and minimum approval for the resource type
			const { review_type: reviewType, min_approval: minApproval } = orgConfigList[resource.type] || {}
			let isPublishResource = false

			// Handle review creation
			if (!review) {
				//check review type is sequential and nobody started review

				if (reviewType === common.REVIEW_TYPE_SEQUENTIAL) {
					const existingReview = await reviewsQueries.findOne({
						resource_id: resourceId,
						status: _notAllowedReviewStatus,
					})

					if (existingReview) {
						return responses.failureResponse({
							message: REVIEW_INPROGRESS,
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
						})
					}
				}

				//create the review entry
				const reviewData = {
					resource_id: resourceId,
					reviewer_id: loggedInUserId,
					status: common.REVIEW_STATUS_INPROGRESS,
					organization_id: orgId,
				}

				const createReview = await reviewsQueries.create(reviewData)
				if (!createReview?.id) {
					return responses.failureResponse({
						message: FAILED_TO_START_REVIEW,
						statusCode: httpStatusCode.internal_server_error,
						responseCode: 'CLIENT_ERROR',
					})
				}

				await reviewResourceQueries.create(_.omit(reviewData, [common.STATUS]))

				// Update resource status to in review
				await resourceQueries.updateOne(
					{ id: resource_id },
					{
						status: common.RESOURCE_STATUS_IN_REVIEW,
						last_reviewed_on: new Date(),
					}
				)

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REVIEW_CREATED',
				})
			} else {
				// Handle existing review updates
				if (
					[common.REVIEW_STATUS_REJECTED, common.REVIEW_STATUS_REJECTED_AND_REPORTED].includes(
						bodyData.status
					)
				) {
					await handleRejectionOrReport(review.id, bodyData, resourceId)
				} else if (bodyData.status === common.REVIEW_STATUS_REQUESTED_FOR_CHANGES) {
					//update the reviews table
					await reviewResourceQueries.updateOne(
						{
							id: review.id,
						},
						{ status: bodyData.status }
					)

					return responses.successResponse({
						statusCode: httpStatusCode.ok,
						message: 'REVIEW_CHANGES_REQUESTED',
					})
				} else if (bodyData.status === common.RESOURCE_STATUS_APPROVED) {
					isPublishResource = await handleApproval(review.id, resourceId, minApproval)
				}
			}

			// Add or update comments
			if (bodyData.comments) {
				await handleComments(bodyData.comments, resourceId, loggedInUserId)
			}

			// Publish resource if applicable
			if (isPublishResource) {
				//call diksha api or flink job
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCE_PUBLISHED',
				})
			}
		} catch (error) {
			throw error
		}
	}

	static async handleRejectionOrReport(reviewId, bodyData, resourceId) {
		try {
			// handle rejection or report of a review
			let updateObj = { status: bodyData.status }
			if (bodyData.notes) {
				updateObj.notes = bodyData.notes
			}

			await resourceQueries.updateOne({ id: resourceId }, updateObj)

			await reviewResourceQueries.updateOne({ id: reviewId }, { status: bodyData.status })

			const message =
				bodyData.status === common.REVIEW_STATUS_REJECTED ? 'REVIEW_REJECTED' : 'REVIEW_REJECTED_AND_REPORTED'

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message,
			})
		} catch (error) {
			throw error
		}
	}

	static async handleApproval(reviewId, resourceId, minApproval) {
		try {
			// handle approval of a review
			let publishResource = false
			await reviewResourceQueries.updateOne({ id: reviewId }, { status: common.RESOURCE_STATUS_APPROVED })

			//check the no of approvals meets
			const reviewsApproved = await reviewsQueries.findAll({
				resource_id: resourceId,
				status: common.REVIEW_STATUS_APPROVED,
			})

			if (minApproval <= reviewsApproved.length + 1) {
				await resourceQueries.updateOne({ id: resourceId }, { status: common.RESOURCE_STATUS_PUBLISHED })

				publishResource = true
			}

			return publishResource
		} catch (error) {
			throw error
		}
	}
}

function _notAllowedStatusForReview() {
	return [
		common.RESOURCE_STATUS_REJECTED,
		common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
		common.RESOURCE_STATUS_PUBLISHED,
	]
}

function _notAllowedReviewStatus() {
	return [
		common.RESOURCE_STATUS_REJECTED,
		common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
		common.REVIEW_STATUS_INPROGRESS,
		common.REVIEW_STATUS_REJECTED_AND_REPORTED,
	]
}

async function handleComments(comments, resourceId, loggedInUserId) {
	try {
		// handle adding or updating comments
		for (const comment of comments) {
			if (comment.id) {
				await commentQueries.updateOne({ id: comment.id, resource_id: resourceId }, _.omit(comment, ['id']))
			} else {
				comment.user_id = loggedInUserId
				comment.resource_id = resourceId
				comment.status = common.COMMENT_STATUS_OPEN
				await commentQueries.create(comment)
			}
		}

		return true
	} catch (error) {
		throw error
	}
}

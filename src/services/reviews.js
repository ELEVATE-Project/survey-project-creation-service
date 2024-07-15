// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const reviewsQueries = require('@database/queries/reviews')
const reviewResourceQueries = require('@database/queries/reviewResources')
const resourceQueries = require('@database/queries/resources')
const responses = require('@helpers/responses')
const configService = require('@services/config')
const commentQueries = require('@database/queries/comments')
const _ = require('lodash')
const kafkaCommunication = require('@generics/kafka-communication')
const resourceService = require('@services/resource')

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
			let resourceDetails = await resourceService.getDetails(resourceId)
			if (resourceDetails.statusCode !== httpStatusCode.ok) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let resource = resourceDetails.result

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
			let updateNextLevel = false

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
							message: 'REVIEW_INPROGRESS',
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
						})
					}

					updateNextLevel = true
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
						message: 'FAILED_TO_START_REVIEW',
						statusCode: httpStatusCode.internal_server_error,
						responseCode: 'CLIENT_ERROR',
					})
				}

				await reviewResourceQueries.create(_.omit(reviewData, [common.STATUS]))

				// Update resource table data
				let filter = {
					status: common.RESOURCE_STATUS_IN_REVIEW,
					last_reviewed_on: new Date(),
				}

				if (updateNextLevel) {
					filter.next_level = resource.next_level + 1
				}

				await resourceQueries.updateOne({ id: resourceId }, filter)

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
					await this.handleRejectionOrReport(
						review.id,
						bodyData,
						resourceId,
						loggedInUserId,
						bodyData.comment,
						resource.type
					)
				} else if (bodyData.status === common.REVIEW_STATUS_REQUESTED_FOR_CHANGES) {
					//update the reviews table
					await this.handleChangesRequested(review.id, bodyData, resourceId, loggedInUserId, bodyData.comment)
				} else if (bodyData.status === common.RESOURCE_STATUS_APPROVED) {
					isPublishResource = await this.handleApproval(
						review.id,
						resourceId,
						loggedInUserId,
						bodyData.comment,
						minApproval
					)
				}
			}

			// Publish resource if applicable
			if (isPublishResource) {
				//call api or kafka
				if (process.env.CONSUMPTION_SERVICE != common.SELF) {
					if (process.env.PUBLISH_METHOD === common.PUBLISH_METHOD_KAFKA) {
						await kafkaCommunication.pushResourceToKafka(resource)
					} else {
						//api need to implement
					}
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCE_PUBLISHED',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_UPDATED',
			})
		} catch (error) {
			throw error
		}
	}

	static async handleRejectionOrReport(reviewId, bodyData, resourceId, loggedInUserId, comments = [], resourceType) {
		try {
			//program cannot reject or report
			if (resourceType === common.RESOURCE_TYPE_PROGRAM) {
				return responses.failureResponse({
					message: 'PROGRAM_REJECTION_NOT_ALLOWED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// handle rejection or report of a review
			let updateObj = { status: bodyData.status }
			if (bodyData.notes) {
				updateObj.notes = bodyData.notes
			}

			await resourceQueries.updateOne({ id: resourceId }, _.omit(updateObj, ['notes']))

			await reviewsQueries.update({ id: reviewId }, updateObj)

			// Add or update comments
			if (comments) {
				await handleComments(comments, resourceId, loggedInUserId)
			}

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

	static async handleChangesRequested(reviewId, bodyData, resourceId, loggedInUserId, comments = []) {
		try {
			//update reviews table
			await reviewsQueries.update({ id: reviewId }, { status: bodyData.status })

			// Add or update comments
			if (comments) {
				await handleComments(comments, resourceId, loggedInUserId)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_CHANGES_REQUESTED',
			})
		} catch (error) {
			throw error
		}
	}

	static async handleApproval(reviewId, resourceId, loggedInUserId, comments = [], minApproval) {
		try {
			// handle approval of a review
			let publishResource = false
			await reviewsQueries.update({ id: reviewId }, { status: common.RESOURCE_STATUS_APPROVED })

			// Add or update comments
			if (comments) {
				await handleComments(comments, resourceId, loggedInUserId)
			}

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
		common.REVIEW_STATUS_CHANGES_UPDATED,
		common.REVIEW_STATUS_INPROGRESS,
		common.REVIEW_STATUS_REJECTED_AND_REPORTED,
	]
}

async function handleComments(comments, resourceId, loggedInUserId) {
	try {
		// Normalize comments to an array if it's a single object
		if (!Array.isArray(comments)) {
			comments = [comments]
		}
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

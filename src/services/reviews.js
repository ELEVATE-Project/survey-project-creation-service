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
	 * @param {Integer} resourceId - resource id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @returns {JSON} - review updated response.
	 */

	static async update(resourceId, bodyData, loggedInUserId, orgId) {
		try {
			//get resource details
			let resourceDetails = await resourceService.getDetails(resourceId)
			if (resourceDetails.statusCode !== httpStatusCode.ok) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const resource = resourceDetails.result

			//validate resource status
			if (_notAllowedStatusForReview.includes(resource.status)) {
				return responses.failureResponse({
					message: `Resource is already ${resource.status}. You can't review it`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Fetch organization configuration
			const orgConfig = await configService.list(orgId)
			const orgConfigList = orgConfig.result.reduce((acc, item) => {
				acc[item.resource_type] = {
					review_type: item.review_type,
					min_approval: item.min_approval,
				}
				return acc
			}, {})

			let createReview = false
			let isPublishResource = false
			let updateNextLevel = false

			// Extract review type and minimum approval for the resource type
			const { review_type: reviewType, min_approval: minApproval } = orgConfigList[resource.type] || {}

			//Check if the logged-in user started the review
			const reviewResource = await reviewResourceQueries.findOne({
				reviewer_id: loggedInUserId,
				resource_id: resourceId,
			})

			let review

			if (!reviewResource || !reviewResource.id) {
				createReview = true
			} else {
				review = await reviewsQueries.findOne({
					organization_id: reviewResource.organization_id,
					resource_id: resourceId,
					reviewer_id: loggedInUserId,
				})

				if (!review || !review.id) {
					return responses.failureResponse({
						message: 'REVIEW_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
			}

			//handle the review creation
			if (createReview) {
				//Check review type is parallel and already another person reviewing the resource
				if (reviewType === common.REVIEW_TYPE_SEQUENTIAL) {
					const existingReview = await reviewsQueries.findOne({
						organization_id: resource.organization_id,
						resource_id: resourceId,
						status: _notAllowedReviewStatus,
					})

					if (existingReview?.id) {
						return responses.failureResponse({
							message: 'REVIEW_INPROGRESS',
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
						})
					}

					updateNextLevel = true
				}

				//create a new entry in reviews and review_resources table
				const reviewData = {
					resource_id: resourceId,
					reviewer_id: loggedInUserId,
					status: bodyData.status,
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
				let updateData = {
					status: common.RESOURCE_STATUS_IN_REVIEW,
					last_reviewed_on: new Date(),
				}

				if (updateNextLevel) {
					updateData.next_level = resource.next_level + 1
				}

				await resourceQueries.updateOne(
					{ organization_id: resource.organization_id, id: resourceId },
					updateData
				)

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REVIEW_CREATED',
				})
			} else {
				//update existing review
				//check review is exist
				if (!review?.id) {
					return responses.failureResponse({
						message: 'REVIEW_NOT_FOUND',
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

				//check already someone started review
				if (review.status === common.REVIEW_STATUS_NOT_STARTED) {
					const existingReview = await reviewsQueries.findOne({
						organization_id: resource.organization_id,
						resource_id: resourceId,
						status: _notAllowedReviewStatus,
					})

					if (existingReview?.id) {
						return responses.failureResponse({
							message: 'REVIEW_INPROGRESS',
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
						})
					}
				}

				//update the review
				if (
					[common.REVIEW_STATUS_REJECTED, common.REVIEW_STATUS_REJECTED_AND_REPORTED].includes(
						bodyData.status
					)
				) {
					const rejection = await this.handleRejectionOrReport(
						review.id,
						bodyData,
						resourceId,
						loggedInUserId,
						bodyData.comment,
						resource.type,
						resource.organization_id,
						review.organization_id
					)
					return rejection
				} else if (
					[common.REVIEW_STATUS_REQUESTED_FOR_CHANGES, common.REVIEW_STATUS_INPROGRESS].includes(
						bodyData.status
					)
				) {
					//update the reviews table
					const updateReview = await this.handleUpdateReview(
						review.id,
						bodyData,
						resourceId,
						loggedInUserId,
						bodyData.comment,
						review.organization_id
					)
					return updateReview
				} else if (bodyData.status === common.RESOURCE_STATUS_APPROVED) {
					isPublishResource = await this.handleApproval(
						review.id,
						resourceId,
						loggedInUserId,
						bodyData.comment,
						minApproval,
						resource.organization_id,
						review.organization_id
					)
				}
			}

			// Publish resource if applicable
			if (isPublishResource) {
				const publishResource = await resourceService.publishResource(resourceId, resourceDetails.user_id)
				return publishResource
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_UPDATED',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Reject/Report the resource
	 * @method
	 * @name handleRejectionOrReport
	 * @param {Integer} reviewId - review id.
	 * @param {Object} bodyData - review body data.
	 * @param {Integer} resourceId - resource id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @param {Array} comments - comments.
	 * @param {String} resourceType - resource type.
	 * @param {String} resourceOrgId - resource org id.
	 * @param {String} reviewOrgId - review org id.
	 * @returns {JSON} - review updated response.
	 */
	static async handleRejectionOrReport(
		reviewId,
		bodyData,
		resourceId,
		loggedInUserId,
		comments = [],
		resourceType,
		resourceOrgId,
		reviewOrgId
	) {
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

			await resourceQueries.updateOne(
				{ id: resourceId, organization_id: resourceOrgId },
				_.omit(updateObj, ['notes'])
			)

			await reviewsQueries.update({ id: reviewId, organization_id: reviewOrgId }, updateObj)

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

	/**
	 * Update the review
	 * @method
	 * @name handleUpdateReview
	 * @param {Integer} reviewId - review id.
	 * @param {Object} bodyData - review body data.
	 * @param {Integer} resourceId - resource id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @param {Array} comments - comments.
	 * @param {String} organization_id - org id.
	 * @returns {JSON} - review updated response.
	 */
	static async handleUpdateReview(reviewId, bodyData, resourceId, loggedInUserId, comments = [], organization_id) {
		try {
			//update reviews table
			await reviewsQueries.update({ id: reviewId, organization_id: organization_id }, { status: bodyData.status })

			// Add or update comments
			if (comments) {
				await handleComments(comments, resourceId, loggedInUserId)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message:
					bodyData.status === common.REVIEW_STATUS_REQUESTED_FOR_CHANGES
						? 'REVIEW_CHANGES_REQUESTED'
						: 'REVIEW_UPDATED',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Approve the review
	 * @method
	 * @name handleApproval
	 * @param {Integer} reviewId - review id.
	 * @param {Object} bodyData - review body data.
	 * @param {Integer} resourceId - resource id.
	 * @param {String} loggedInUserId - logged in user id.
	 * @param {Array} comments - comments.
	 * @param {String} minApproval - min approval
	 * @param {String} resourceOrgId - resource org id.
	 * @param {String} reviewOrgId - review org id.
	 * @returns {JSON} - review updated response.
	 */
	static async handleApproval(
		reviewId,
		resourceId,
		loggedInUserId,
		comments = [],
		minApproval,
		resourceOrgId,
		reviewOrgId
	) {
		try {
			// handle approval of a review
			let publishResource = false
			await reviewsQueries.update(
				{ id: reviewId, organization_id: reviewOrgId },
				{ status: common.RESOURCE_STATUS_APPROVED }
			)

			// Add or update comments
			if (comments) {
				await handleComments(comments, resourceId, loggedInUserId)
			}

			// Check if the number of approved reviews meets or exceeds the minimum required approvals
			const reviewsApproved = await reviewsQueries.countDistinct({
				resource_id: resourceId,
				status: common.REVIEW_STATUS_APPROVED,
			})

			if (minApproval <= reviewsApproved) {
				await resourceQueries.updateOne(
					{ id: resourceId, organization_id: resourceOrgId },
					{ status: common.RESOURCE_STATUS_PUBLISHED, published_on: new Date() }
				)
				publishResource = true
			}

			return publishResource
		} catch (error) {
			throw error
		}
	}
}

const _notAllowedStatusForReview = [
	common.RESOURCE_STATUS_REJECTED,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
	common.RESOURCE_STATUS_PUBLISHED,
]

const _notAllowedReviewStatus = [
	common.REVIEW_STATUS_STARTED,
	common.RESOURCE_STATUS_REJECTED,
	common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
	common.REVIEW_STATUS_CHANGES_UPDATED,
	common.REVIEW_STATUS_INPROGRESS,
	common.REVIEW_STATUS_REJECTED_AND_REPORTED,
]

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

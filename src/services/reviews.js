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

module.exports = class reviewsHelper {
	/**
	 * Update review.
	 * @method
	 * @name update
	 * @param {Object} bodyData - review body data.
	 * @param {Integer} resourceId - resource id.
	 * @param {String} userId - logged in user id.
	 * @param {String} orgId - organization id
	 * @returns {JSON} - review updated response.
	 */

	static async update(resourceId, bodyData, userId, orgId) {
		try {
			//get resource details
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'status', 'organization_id', 'type', 'next_level'] }
			)

			if (!resource?.id) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//validate resource status
			if (_nonReviewableResourceStatuses.includes(resource.status)) {
				return responses.failureResponse({
					message: `Resource is already ${resource.status}. You can't review it`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Fetch organization configuration
			const orgConfig = await orgExtensionService.list(orgId)
			const orgConfigList = orgConfig.result.resource.reduce((acc, item) => {
				acc[item.resource_type] = {
					review_type: item.review_type,
				}
				return acc
			}, {})

			// Extract review type and minimum approval for the resource type
			const { review_type: reviewType } = orgConfigList[resource.type]

			//Check if the logged-in user started the review
			const reviewResource = await reviewResourceQueries.findOne({
				reviewer_id: userId,
				resource_id: resourceId,
			})

			if (!reviewResource || !reviewResource.id) {
				return await this.createReview(resourceId, reviewType, userId, resource.organization_id, orgId)
			}

			// Fetch review details if reviewResource exists
			const review = await reviewsQueries.findOne({
				organization_id: reviewResource.organization_id,
				resource_id: resourceId,
				reviewer_id: userId,
			})

			if (!review || !review.id) {
				return responses.failureResponse({
					message: 'REVIEW_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//validate resource status
			const validateResourceStatus = await this.validateResourceStatus(resourceStatus)
			if (validateResourceStatus.statusCode !== httpStatusCode.ok) {
				return validateResourceStatus
			}

			// Check if the review is already started by someone else
			if (review.status === common.REVIEW_STATUS_NOT_STARTED) {
				const reviewCheck = this.validateNoActiveReviewByOthers(resourceId, userId, orgId)
				if (reviewCheck.statusCode !== httpStatusCode.ok) {
					return reviewCheck
				}
			}

			// Add or update comments
			if (bodyData.comment) {
				await handleComments(bodyData.comment, resourceId, userId)
			}

			//update resource and review table
			await reviewsQueries.update(
				{ id: review.id, organization_id: review.organization_id },
				{ status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES }
			)

			await resourceQueries.updateOne(
				{ organization_id: resource.organization_id, id: resourceId },
				{ last_reviewed_on: new Date() }
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_CHANGES_REQUESTED',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Approve resource
	 * @method
	 * @name approveResource
	 * @param {Object} bodyData - review body data.
	 * @param {Integer} resourceId - resource id.
	 * @param {String} userId - logged in user id.
	 * @param {String} orgId - organization id.
	 * @returns {JSON} - review approved response.
	 */

	static async approveResource(resourceId, bodyData, userId, orgId) {
		try {
			// Retrieve and validate resource
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'status', 'organization_id', 'type', 'user_id'] }
			)

			if (!resource?.id) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//validate resource
			let validateReview = await this.validateReview(resourceId, userId, resource.status, orgId)
			if (validateReview.statusCode !== httpStatusCode.ok) {
				return validateReview
			}

			const review = validateReview.result
			// Check if resource is already approved or requested for changes
			if ([common.REVIEW_STATUS_APPROVED, common.REVIEW_STATUS_REQUESTED_FOR_CHANGES].includes(review.status)) {
				return responses.failureResponse({
					message: 'RESOURCE_APPROVAL_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Fetch organization configuration and determine review type and minimum approval
			const orgConfig = await orgExtensionService.list(orgId)
			const orgConfigList = orgConfig.result.resource.reduce((acc, item) => {
				acc[item.resource_type] = {
					review_type: item.review_type,
					min_approval: item.min_approval,
				}
				return acc
			}, {})

			// Extract review type and minimum approval for the resource type
			const { min_approval: minApproval } = orgConfigList[resource.type]

			// Handle approval and check if resource should be published
			let isPublishResource = await this.handleApproval(
				review.id,
				resourceId,
				userId,
				bodyData.comment,
				minApproval,
				review.organization_id
			)

			// Publish resource if applicable
			if (isPublishResource) {
				const publishResource = await resourceService.publishResource(resourceId, resource.user_id)
				return publishResource
			}
			// updating the resource last reviewed at
			await resourceQueries.updateOne(
				{ organization_id: resource.organization_id, id: resourceId },
				{ last_reviewed_on: new Date() }
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_UPDATED',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Report or Reject resource
	 * @method
	 * @name rejectOrReportResource
	 * @param {Object} bodyData - review body data.
	 * @param {Integer} resourceId - resource id.
	 * @param {Boolean} isReported - Indicate the resource is reported or not
	 * @param {String} userId - logged in user id.
	 * @param {String} orgId - organization id.
	 * @returns {JSON} - review rejected/reported response.
	 */

	static async rejectOrReportResource(resourceId, isReported, bodyData, userId, orgId) {
		try {
			// Retrieve and validate resource
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'status', 'organization_id', 'type'] }
			)

			if (!resource?.id) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//validate resource
			let validateReview = await this.validateReview(resourceId, userId, resource.status, orgId)
			if (validateReview.statusCode !== httpStatusCode.ok) {
				return validateReview
			}

			const review = validateReview.result

			//program cannot reject or report
			if (resource.type === common.RESOURCE_TYPE_PROGRAM) {
				return responses.failureResponse({
					message: 'PROGRAM_REJECTION_NOT_ALLOWED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Handle comments if provided
			if (bodyData.comment) {
				await handleComments(bodyData.comment, resourceId, userId)
			}

			let updateObj = {
				status: isReported ? common.REVIEW_STATUS_REJECTED_AND_REPORTED : common.REVIEW_STATUS_REJECTED,
				...(bodyData.notes && { notes: bodyData.notes }),
			}

			//update reviews
			await reviewsQueries.update({ id: review.id, organization_id: review.organization_id }, updateObj)

			updateObj.last_reviewed_on = new Date()

			// Update the resource (excluding notes)
			await resourceQueries.updateOne(
				{ id: resourceId, organization_id: resource.organization_id },
				_.omit(updateObj, ['notes'])
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: isReported ? 'REVIEW_REJECTED_AND_REPORTED' : 'REVIEW_REJECTED',
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
	 * @param {String} userId - logged in user id.
	 * @param {Array} comments - comments.
	 * @param {String} minApproval - min approval
	 * @param {String} reviewOrgId - review org id.
	 * @returns {JSON} - review approval response.
	 */
	static async handleApproval(reviewId, resourceId, userId, comments = [], minApproval, reviewOrgId) {
		try {
			// Add or update comments
			if (comments) {
				await handleComments(comments, resourceId, userId)
			}

			// Update the review status to approved
			await reviewsQueries.update(
				{ id: reviewId, organization_id: reviewOrgId },
				{ status: common.RESOURCE_STATUS_APPROVED }
			)

			// Count the number of approved reviews for the resource
			const reviewsApproved = await reviewsQueries.count({
				resource_id: resourceId,
				status: common.REVIEW_STATUS_APPROVED,
			})

			// Determine if the resource should be published
			const publishResource = reviewsApproved >= minApproval
			return publishResource
		} catch (error) {
			throw error
		}
	}

	/**
	 * Create Review
	 * @method
	 * @name createReview
	 * @param {Integer} resourceId - resource id.
	 * @param {Boolean} reviewType - Review type
	 * @param {String} userId - logged in user id.
	 * @param {String} userOrgId - logged in user org id.
	 * @param {String} resourceOrgId - organization id.
	 * @returns {JSON} - review creation response.
	 */

	static async createReview(resourceId, reviewType, userId, resourceOrgId, userOrgId) {
		try {
			let updateNextLevel = false
			//Check review type is parallel and already another person reviewing the resource
			if (reviewType === common.REVIEW_TYPE_SEQUENTIAL) {
				const activeReviewValidation = await this.validateNoActiveReviewByOthers(
					resourceId,
					userId,
					resourceOrgId
				)
				if (activeReviewValidation.statusCode !== httpStatusCode.ok) {
					return activeReviewValidation
				}

				updateNextLevel = true
			}

			//create a new entry in reviews and review_resources table
			const reviewData = {
				resource_id: resourceId,
				reviewer_id: userId,
				status: common.REVIEW_STATUS_STARTED,
				organization_id: userOrgId,
			}

			const newReview = await reviewsQueries.create(reviewData)
			if (!newReview?.id) {
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
				...(updateNextLevel && { next_level: resource.next_level + 1 }),
			}

			await resourceQueries.updateOne({ organization_id: resourceOrgId, id: resourceId }, updateData)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_CREATED',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Validating the Resource for review creation or update
	 * @method
	 * @name validateReview
	 * @param {Integer} resourceId - resource id.
	 * @param {String} userId - logged in user id.
	 * @param {String} resourceStatus - resource status
	 * @param {String} orgId - organization Id
	 * @returns {JSON} - review validation response.
	 */

	static async validateReview(resourceId, userId, resourceStatus, orgId) {
		try {
			//validate resource status
			const validateResourceStatus = await this.validateResourceStatus(resourceStatus)
			if (validateResourceStatus.statusCode !== httpStatusCode.ok) {
				return validateResourceStatus
			}

			// Validate review existence and fetch review details
			const reviewValidation = await this.verifyAndFetchReview(userId, resourceId)
			if (reviewValidation.statusCode !== httpStatusCode.ok) {
				return reviewValidation
			}

			const review = reviewValidation.result

			// Check if another reviewer has already started the review
			if (review.status === common.REVIEW_STATUS_NOT_STARTED) {
				const activeReviewCheck = this.validateNoActiveReviewByOthers(resourceId, userId, orgId)
				if (activeReviewCheck.statusCode !== httpStatusCode.ok) {
					return activeReviewCheck
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'VALIDATION_PASSED',
				result: review,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Validating the Resource status
	 * @method
	 * @name validateResourceStatus
	 * @param {String} status - resource status
	 * @returns {JSON} - return error if any
	 */

	static async validateResourceStatus(status) {
		// Check if the resource status is non-reviewable
		if (_nonReviewableResourceStatuses.includes(status)) {
			return responses.failureResponse({
				message: `Resource is already ${status}. You can't review it`,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
		// Return success response if the status is reviewable
		return responses.successResponse({
			statusCode: httpStatusCode.ok,
		})
	}

	/**
	 * Validating the review
	 * @method
	 * @name verifyAndFetchReview
	 * @param {String} userId - user id
	 * @param {Integer} resourceId - resource id
	 * @returns {JSON} - return error if any
	 */

	static async verifyAndFetchReview(userId, resourceId) {
		//Check if the logged-in user started the review
		const reviewResource = await reviewResourceQueries.findOne({
			reviewer_id: userId,
			resource_id: resourceId,
		})

		// If the review resource is not found, return an error response
		if (!reviewResource || !reviewResource.id) {
			return responses.failureResponse({
				message: 'REVIEW_NOT_FOUND',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		// Fetch the review
		const review = await reviewsQueries.findOne({
			organization_id: reviewResource.organization_id,
			resource_id: resourceId,
			reviewer_id: userId,
		})

		// If the review is not found, return an error response
		if (!review || !review.id) {
			return responses.failureResponse({
				message: 'REVIEW_NOT_FOUND',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		return responses.successResponse({
			statusCode: httpStatusCode.ok,
			result: review,
		})
	}

	/**
	 * Check the review is already started by someone
	 * @method
	 * @name validateNoActiveReviewByOthers
	 * @param {String} userId - user Id
	 * @param {Integer} resourceId - resource Id
	 * @param {String} orgId - organization Id
	 * @returns {JSON} - return error if any
	 */

	static async validateNoActiveReviewByOthers(resourceId, userId, orgId) {
		// Check if there's an existing active review by another user
		const existingReview = await reviewsQueries.findOne({
			organization_id: orgId,
			resource_id: resourceId,
			reviewer_id: { [Op.not]: userId },
			status: { [Op.in]: _restrictedReviewStatuses },
		})

		// If an active review exists by another user, return an error response
		if (existingReview?.id) {
			return responses.failureResponse({
				message: 'REVIEW_INPROGRESS',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}

		// If no active review is found, return a success response
		return responses.successResponse({
			statusCode: httpStatusCode.ok,
		})
	}
}

// If a resource has any of these statuses, the reviewer is not allowed to review it.
const _nonReviewableResourceStatuses = [
	common.RESOURCE_STATUS_REJECTED,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
	common.RESOURCE_STATUS_PUBLISHED,
]

// If a review is in any of these statuses, the reviewer is not allowed to review it.
const _restrictedReviewStatuses = [
	common.REVIEW_STATUS_STARTED,
	common.RESOURCE_STATUS_REJECTED,
	common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
	common.REVIEW_STATUS_CHANGES_UPDATED,
	common.REVIEW_STATUS_INPROGRESS,
	common.REVIEW_STATUS_REJECTED_AND_REPORTED,
]
/**
 * Create or update comment
 * @method
 * @name handleComments
 * @param {Integer} resourceId - resource id.
 * @param {String} userId - logged in user id.
 * @param {Object/Array} comments - comments.
 * @returns {Boolean} - return true
 */
async function handleComments(comments, resourceId, userId) {
	try {
		// Normalize comments to an array if it's a single object
		if (!Array.isArray(comments)) {
			comments = [comments]
		}

		// Separate comments into ones that need to be updated and ones that need to be created
		const commentsToUpdate = []
		const commentsToCreate = []

		for (let comment of comments) {
			if (comment.id) {
				commentsToUpdate.push(comment)
			} else {
				comment.user_id = userId
				comment.resource_id = resourceId
				comment.status = common.COMMENT_STATUS_OPEN
				commentsToCreate.push(comment)
			}
		}

		// Handle updating comments
		const updatePromises = commentsToUpdate.map((comment) =>
			commentQueries.updateOne({ id: comment.id, resource_id: resourceId }, _.omit(comment, ['id']))
		)

		// Handle creating comments in bulk
		const createPromise =
			commentsToCreate.length > 0 ? commentQueries.bulkCreate(commentsToCreate) : Promise.resolve()

		await Promise.all([...updatePromises, createPromise])
		return { success: true }
	} catch (error) {
		return error
	}
}

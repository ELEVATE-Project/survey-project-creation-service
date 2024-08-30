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
	 * Update review.
	 * @method
	 * @name update
	 * @param {Object} bodyData - review body data.
	 * @param {Boolean} startReview - To identity the status of review
	 * @param {Integer} resourceId - resource id.
	 * @param {String} userId - logged in user id.
	 * @param {String} orgId - organization id
	 * @returns {JSON} - review updated response.
	 */

	static async update(resourceId, bodyData, userId, orgId) {
		try {
			// Retrieve resource details based on the provided resourceId.
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'status', 'organization_id', 'type', 'next_stage'] }
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
			// Update the 'last_reviewed_on' field in the resources table
			await Promise.all([
				reviewsQueries.update(
					{ id: review.id, organization_id: review.organization_id },
					{ status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES }
				),
				resourceQueries.updateOne(
					{ organization_id: resource.organization_id, id: resourceId },
					{ last_reviewed_on: new Date() }
				),
			])

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

	/**
	 * Start review.
	 * @method
	 * @name start
	 * @param {Integer} resourceId - resource id.
	 * @param {String} userId - logged in user id.
	 * @param {String} orgId - organization id
	 * @param {String} userRoles - roles
	 * @returns {JSON} - review started response.
	 */
	static async start(resourceId, userId, orgId, userRoles) {
		try {
			// Retrieve resource details based on the provided resourceId.
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'status', 'organization_id', 'type', 'next_stage'] }
			)

			// If no resource is found return error
			if (!resource?.id) throw new Error('RESOURCE_NOT_FOUND')

			// Validate the current status of the resource to determine if it is available for review.
			const validateResourceStatus = await this.isResourceAvailableForReview(resource.status)
			if (!validateResourceStatus) throw new Error(`Resource is already ${resource.status}. You can't review it`)

			// Fetch the configuration settings for the organization based on the provided orgId.
			const orgConfig = await orgExtensionService.getConfig(orgId)
			const orgConfigList = orgConfig.result.resource.reduce((acc, item) => {
				acc[item.resource_type] = {
					review_type: item.review_type,
				}
				return acc
			}, {})

			// Extract review type and minimum approval for the resource type
			const { review_type: reviewType } = orgConfigList[resource.type]

			//Check if the logged-in user started the review
			const reviewResource = await reviewResourceQueries.findOne(
				{
					reviewer_id: userId,
					resource_id: resourceId,
				},
				{ attributes: ['id', 'organization_id'] }
			)

			// If the review resource does not exist create the review
			if (!reviewResource?.id) {
				return await this.createReview(
					resourceId,
					reviewType,
					userId,
					resource.organization_id,
					orgId,
					resource.next_stage,
					userRoles,
					resource.type
				)
			}

			// If reviewResource exists, fetch the review details for the specific organization, resource
			const review = await reviewsQueries.findOne({
				organization_id: reviewResource.organization_id,
				resource_id: resourceId,
				reviewer_id: userId,
			})

			// Check if the review exists; if not, return a failure response
			if (!review?.id) throw new Error('REVIEW_NOT_FOUND')

			//check the review is already started
			if (review.status === common.REVIEW_STATUS_STARTED) throw new Error('REVIEW_ALREADY_STARTED')

			// If the review status is 'NOT_STARTED', validate that no active review is being conducted by others.
			if (review.status === common.REVIEW_STATUS_NOT_STARTED) {
				const reviewCheck = await this.validateNoActiveReviewByOthers(resourceId, userId, orgId)
				if (reviewCheck.statusCode !== httpStatusCode.ok) {
					return reviewCheck
				}
			}

			// Update the status in the reviews table
			// Update the 'last_reviewed_on' field in the resources table
			await Promise.all([
				reviewsQueries.update(
					{ id: review.id, organization_id: review.organization_id },
					{ status: common.REVIEW_STATUS_INPROGRESS }
				),
				resourceQueries.updateOne(
					{ organization_id: resource.organization_id, id: resourceId },
					{ status: common.RESOURCE_STATUS_IN_REVIEW, last_reviewed_on: new Date() }
				),
			])

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_CREATED',
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Approve a resource
	 * @method
	 * @name approveResource
	 * @param {Object} bodyData - Data related to the review, including approval comments
	 * @param {Integer} resourceId - The ID of the resource being approved.
	 * @param {String} userId - The ID of the user who is approving the resource.
	 * @param {String} orgId - The ID of the organization that owns the resource.
	 * @returns {JSON} - The response indicating the result of the resource approval.
	 */
	static async approveResource(resourceId, bodyData, userId, orgId) {
		try {
			// Retrieve resource details based on the provided resourceId.
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'status', 'organization_id', 'type', 'user_id', 'next_stage'] }
			)
			// If no resource is found return error
			if (!resource?.id) throw new Error('RESOURCE_NOT_FOUND')

			// Validate if there is an ongoing review for the given resourceId, userId, resource status, and orgId.
			let ongoingReview = await this.validateReview(resourceId, userId, resource.status, orgId)
			if (ongoingReview.statusCode !== httpStatusCode.ok) {
				return ongoingReview
			}

			const review = ongoingReview.result
			// Check if resource is already approved or requested for changes
			if ([common.REVIEW_STATUS_APPROVED, common.REVIEW_STATUS_REQUESTED_FOR_CHANGES].includes(review.status)) {
				throw new Error('RESOURCE_APPROVAL_FAILED')
			}

			// Fetch organization configuration and determine review type and minimum approval
			const orgConfig = await orgExtensionService.getConfig(orgId)
			const orgConfigList = orgConfig.result.resource.reduce((acc, item) => {
				acc[item.resource_type] = {
					review_type: item.review_type,
					min_approval: item.min_approval,
				}
				return acc
			}, {})

			// Extract review type and minimum approval for the resource type
			const { min_approval: minApproval, review_type: reviewType } = orgConfigList[resource.type]

			// Handle the approval process and check if resource should be published
			let isPublishResource = await this.handleApproval(
				review.id,
				resourceId,
				userId,
				bodyData.comment,
				minApproval,
				review.organization_id,
				reviewType,
				resource.organization_id,
				resource.next_stage
			)

			// Publish resource if isPublishResource is true
			if (isPublishResource) {
				const publishResource = await this.publishResource(resourceId, resource.user_id)
				return publishResource
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEW_APPROVED',
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Report or reject a resource based on review outcome
	 * @method
	 * @name rejectOrReportResource
	 * @param {Object} bodyData - The data associated with the resource rejection or report, including notes and comments.
	 * @param {Integer} resourceId - The ID of the resource being reported or rejected.
	 * @param {Boolean} isReported - Indicates whether the resource is reported (true) or just rejected (false).
	 * @param {String} userId - The ID of the user who is reporting or rejecting the resource.
	 * @param {String} orgId - The ID of the organization that owns the resource.
	 * @returns {JSON} - The response indicating the result of the resource rejection or report.
	 */
	static async rejectOrReportResource(resourceId, isReported, bodyData, userId, orgId) {
		try {
			// Retrieve resource details based on the provided resourceId.
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'status', 'organization_id', 'type'] }
			)
			// If no resource is found return error
			if (!resource?.id) throw new Error('RESOURCE_NOT_FOUND')

			//program cannot reject or report
			if (resource.type === common.RESOURCE_TYPE_PROGRAM) throw new Error('PROGRAM_REJECTION_NOT_ALLOWED')

			// Validate if there is an ongoing review for the given resourceId, userId, resource status, and orgId.
			let ongoingReview = await this.validateReview(resourceId, userId, resource.status, orgId)
			if (ongoingReview.statusCode !== httpStatusCode.ok) {
				return ongoingReview
			}

			const review = ongoingReview.result

			// If the bodyData contains a comment Add or update comments
			if (bodyData.comment) {
				await handleComments(bodyData.comment, resourceId, userId, true)
			}

			let updateObj = {
				status: isReported ? common.REVIEW_STATUS_REJECTED_AND_REPORTED : common.REVIEW_STATUS_REJECTED,
				...(bodyData.notes && { notes: bodyData.notes }),
				last_reviewed_on: new Date(),
			}

			// Update the review record in the reviews table with the new status and notes
			// Update the resource record with the status and 'last_reviewed_on'
			await Promise.all([
				reviewsQueries.update(
					{ id: review.id, organization_id: review.organization_id },
					_.omit(updateObj, ['last_reviewed_on'])
				),
				resourceQueries.updateOne(
					{ id: resourceId, organization_id: resource.organization_id },
					_.omit(updateObj, ['notes'])
				),
			])

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: isReported ? 'REVIEW_REJECTED_AND_REPORTED' : 'REVIEW_REJECTED',
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Approve the review and handle related updates
	 * @method
	 * @name handleApproval
	 * @param {Integer} reviewId - The ID of the review being approved.
	 * @param {Object} bodyData - The data associated with the review approval, including notes.
	 * @param {Integer} resourceId - The ID of the resource being reviewed.
	 * @param {String} userId - The ID of the user who is approving the review.
	 * @param {Array} comments - An array of comments related to the review.
	 * @param {String} minApproval - The minimum number of approvals required for the resource to be published
	 * @param {String} reviewOrgId - The ID of the organization that owns the review.
	 * @param {String} reviewType - The type of review (e.g., sequential or parallel).
	 * @param {String} resourceOrgId - The ID of the organization that owns the resource.
	 * @param {String} currentReviewStage - The current stage of the resource's review process.
	 * @returns {JSON} - The response indicating the result of the review approval process.
	 */
	static async handleApproval(
		reviewId,
		resourceId,
		userId,
		comments = [],
		minApproval,
		reviewOrgId,
		reviewType,
		resourceOrgId,
		currentReviewStage
	) {
		try {
			let updateNextLevel = false
			// Add or update comments if provided.
			if (Array.isArray(comments) ? comments.length > 0 : Object.keys(comments).length > 0) {
				await handleComments(comments, resourceId, userId, true)
			}

			// Update the review status to 'APPROVED' for the given review.
			await reviewsQueries.update(
				{ id: reviewId, organization_id: reviewOrgId },
				{ status: common.RESOURCE_STATUS_APPROVED }
			)

			// Count the number of approved reviews for the resource.
			const reviewsApproved = await reviewsQueries.count({
				resource_id: resourceId,
				status: common.REVIEW_STATUS_APPROVED,
			})

			// If the review type is 'SEQUENTIAL', set the flag to update the next level.
			if (reviewType === common.REVIEW_TYPE_SEQUENTIAL) {
				updateNextLevel = true
			}

			let updateData = {
				last_reviewed_on: new Date(),
				...(updateNextLevel && { next_stage: currentReviewStage + 1 }),
			}

			// Update the resource with the last review date and next_stage (if applicable).
			await resourceQueries.updateOne({ organization_id: resourceOrgId, id: resourceId }, updateData)

			// Determine if the resource should be published based on the number of approved reviews and minimum approval requirements.
			const publishResource = reviewsApproved >= minApproval
			return publishResource
		} catch (error) {
			throw error
		}
	}

	/**
	 * Create review for a resource.
	 * @method
	 * @name createReview
	 * @param {Integer} resourceId - The ID of the resource to be reviewed.
	 * @param {Boolean} reviewType - The type of review ('SEQUENTIAL' or other types).
	 * @param {String} userId - The ID of the logged-in user who is creating the review.
	 * @param {String} userOrgId - The organization ID of the logged-in user.
	 * @param {String} resourceOrgId - The organization ID where the resource belongs.
	 * @param {Array<Object>} userRoles - The roles of the logged-in user.
	 * @param {String} resourceType - The type of the the resource.
	 * @returns {JSON} - Returns a response indicating the result of the review creation.
	 */

	static async createReview(
		resourceId,
		reviewType,
		userId,
		resourceOrgId,
		userOrgId,
		nextStage = null,
		userRoles,
		resourceType
	) {
		try {
			// If the review type is 'SEQUENTIAL', Check if there are no active reviews by others for the same resource
			if (reviewType === common.REVIEW_TYPE_SEQUENTIAL) {
				const activeReviewValidation = await this.validateNoActiveReviewByOthers(
					resourceId,
					userId,
					resourceOrgId
				)

				if (activeReviewValidation.statusCode !== httpStatusCode.ok) return activeReviewValidation

				//get the level of the reviewer based on roles and check with the resource next_level, which is matching reviewer can create the review
				const validateNextLevel = await this.canUserReviewAResource(
					userRoles,
					userOrgId,
					resourceType,
					nextStage
				)
				if (!validateNextLevel) {
					throw new Error('FAILED_TO_START_REVIEW')
				}
			}

			// Prepare data for creating a new review entry
			const reviewData = {
				resource_id: resourceId,
				reviewer_id: userId,
				status: common.REVIEW_STATUS_STARTED,
				organization_id: userOrgId,
			}

			// Create a new review entry in the database
			const newReview = await reviewsQueries.create(reviewData)
			if (!newReview?.id) {
				throw new Error('FAILED_TO_START_REVIEW')
			}
			// Create a corresponding entry in the review_resources table
			await reviewResourceQueries.create(_.omit(reviewData, [common.STATUS]))

			// Update resource table data
			let updateData = {
				status: common.RESOURCE_STATUS_IN_REVIEW,
				last_reviewed_on: new Date(),
			}
			// Update the resource table to reflect the review status and last_reviewed_on
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
	 *  Validate the resource and review status for creation or update of a review.
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
			// Validate resource status to check if it's reviewable
			const validateResourceStatus = await this.isResourceAvailableForReview(resourceStatus)
			if (!validateResourceStatus) {
				throw new Error(`Resource is already ${resourceStatus}. You can't review it`)
			}

			// Check if a review exists for the specified user and resource
			const reviewValidation = await this.getReviewDetails(userId, resourceId)
			if (reviewValidation.statusCode !== httpStatusCode.ok) {
				return reviewValidation
			}

			const review = reviewValidation.result

			// If the review has not started, check if another reviewer is already working on it
			if (review.status === common.REVIEW_STATUS_NOT_STARTED) {
				const activeReviewCheck = await this.validateNoActiveReviewByOthers(resourceId, userId, orgId)
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
	 * Check if the resource status allows it to be reviewed.
	 * @method
	 * @name isResourceAvailableForReview
	 * @param {String} status - The status of the resource to check.
	 * @returns {Boolean} - Returns `true` if the resource status allows review, otherwise `false`.
	 */
	static async isResourceAvailableForReview(status) {
		// Check if the resource status is in the list of non-reviewable statuses
		if (_nonReviewableResourceStatuses.includes(status)) {
			return false
		}
		// Return true if the status allows the resource to be reviewed
		return true
	}

	/**
	 * Retrieves review details for a specific user and resource.
	 * @method
	 * @name getReviewDetails
	 * @param {String} userId - The ID of the user who is the reviewer.
	 * @param {Integer} resourceId - The ID of the resource being reviewed.
	 * @returns {JSON} -  Returns a success response with review details or an error response if the review is not found.
	 */
	static async getReviewDetails(userId, resourceId) {
		try {
			//Check if the logged-in user started the review
			const reviewResource = await reviewResourceQueries.findOne({
				reviewer_id: userId,
				resource_id: resourceId,
			})

			// If the review resource is not found, return an error response
			if (!reviewResource?.id) {
				throw new Error('REVIEW_NOT_FOUND')
			}

			// Fetch the review details of the user
			const review = await reviewsQueries.findOne({
				organization_id: reviewResource.organization_id,
				resource_id: resourceId,
				reviewer_id: userId,
			})

			// If the review is not found, return an error response
			if (!review?.id) {
				throw new Error('REVIEW_NOT_FOUND')
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				result: review,
			})
		} catch (error) {
			throw error
		}
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
		try {
			// Check if there is an existing active review for the given resource by another user
			const existingReview = await reviewsQueries.findOne({
				organization_id: orgId,
				resource_id: resourceId,
				reviewer_id: { [Op.not]: userId },
				status: { [Op.in]: _restrictedReviewStatuses },
			})
			// If an active review exists by another user, return an error response
			if (existingReview?.id) throw new Error('REVIEW_INPROGRESS')

			// If no active review is found, return a success response
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Validate the reviewer level matches the resource level
	 * @method
	 * @name canUserReviewAResource
	 * @param {Array<Object>} roles - user roles
	 * @param {String} userOrgId - organization Id
	 * @param {String} resourceType - Resource type
	 * @param {Integer} currentLevel - current stage of resource
	 * @returns {JSON} - return error if any
	 */
	static async canUserReviewAResource(roles, userOrgId, resourceType, currentLevel) {
		// Extract unique role titles from the roles array.
		const userRoleTitles = utils.getUniqueElements(roles.map((item) => item.title))
		// Fetch the review levels for the resource based on the user's organization ID, role titles, and resource type.
		const resourceWiseLevels = await resourceService.fetchReviewLevels(userOrgId, userRoleTitles, [resourceType])
		/**
		 * sample response
			{
				projects: [1,2]
			} 
		*/
		// Check if the current level is included in the valid levels for the given resource type
		// If the level is not valid, return false.
		if (!resourceWiseLevels?.[resourceType]?.includes(currentLevel)) {
			return false
		}
		// If the level is valid, return true.
		return true
	}

	/**
	 * Publish Resource
	 * @method
	 * @name publishResource
	 * @returns {JSON} - Publish Response
	 */
	static async publishResource(resourceId, userId) {
		try {
			// Fetch the resource creator mapping
			const resource = await resourceCreatorMappingQueries.findOne(
				{ creator_id: userId, resource_id: resourceId },
				['id', 'organization_id']
			)

			if (!resource?.id) throw new Error('RESOURCE_NOT_FOUND')

			// Fetch resource data
			let resourceData = await resourceQueries.findOne({
				id: resourceId,
				organization_id: resource.organization_id,
			})

			let resourceDetails = await resourceService.getDetails(resourceId, resourceData.organization_id)
			if (resourceDetails.statusCode !== httpStatusCode.ok) {
				return resourceDetails
			}

			resourceData = resourceDetails.result

			//publish the resource
			if (process.env.CONSUMPTION_SERVICE != common.SELF) {
				if (process.env.RESOURCE_KAFKA_PUSH_ON_OFF == common.KAFKA_ON) {
					await kafkaCommunication.pushResourceToKafka(resourceData, resourceData.type)
				}
				// api need to implement
			}

			//update resource table
			await resourceQueries.updateOne(
				{ id: resourceId, organization_id: resourceData.organization_id },
				{
					status: common.RESOURCE_STATUS_PUBLISHED,
					published_on: new Date(),
				}
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_PUBLISHED',
			})
		} catch (error) {
			throw error
		}
	}
}

/**
 * List of resource statuses that prevent a reviewer from starting a review.
 * @constant
 * @type {Array<String>}
 */
const _nonReviewableResourceStatuses = [
	common.RESOURCE_STATUS_REJECTED,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
	common.RESOURCE_STATUS_PUBLISHED,
	common.RESOURCE_STATUS_DRAFT,
]
/**
 * If a review is in any of these statuses, the reviewer is not allowed to review it.
 * @constant
 * @type {Array<String>}
 */
const _restrictedReviewStatuses = [
	common.REVIEW_STATUS_STARTED,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
	common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
	common.REVIEW_STATUS_CHANGES_UPDATED,
	common.REVIEW_STATUS_INPROGRESS,
	common.REVIEW_STATUS_REJECTED_AND_REPORTED,
]
/**
 * Create or update comments for a specified resource.
 * @method
 * @name handleComments
 * @param {Integer} resourceId - The ID of the resource to which comments belong.
 * @param {String} userId - The ID of the logged-in user adding or updating comments.
 * @param {Object|Array<Object>} comments - A single comment object or an array of comment objects.
 * @returns {Promise<Object>} - Returns a promise that resolves to an object indicating success or an error.
 */
async function handleComments(comments, resourceId, userId, setCommentsToOpen = false) {
	try {
		// Normalize comments to an array if it's a single object
		if (!Array.isArray(comments)) {
			comments = [comments]
		}

		if (comments) {
			const isValidComment = utils.validateComment(comments)
			if (!isValidComment) throw new Error('COMMENT_INVALID')
		}
		// Separate comments into ones that need to be updated and ones that need to be created
		const commentsToUpdate = []
		const commentsToCreate = []
		let parentCommentIds = []
		for (let comment of comments) {
			comment.comment = comment.text
			delete comment.text
			if (comment?.parent_id) {
				parentCommentIds.push(comment.parent_id)
			}

			if (comment.id) {
				if (comment.status === common.STATUS_RESOLVED) {
					comment.resolved_by = userId
					comment.resolved_at = new Date()
				} else {
					comment.status = common.COMMENT_STATUS_OPEN
				}
				commentsToUpdate.push(comment)
			} else {
				comment.user_id = userId
				comment.resource_id = resourceId
				comment.status = setCommentsToOpen ? common.COMMENT_STATUS_OPEN : comment.status
				commentsToCreate.push(comment)
			}
		}

		const isCommentValid = await isParantCommentValid(parentCommentIds, resourceId)
		if (!isCommentValid) throw new Error('COMMENT_PARENT_INVALID')

		// Handle updating comments
		const updatePromises = commentsToUpdate.map((comment) =>
			commentQueries.updateOne(
				{ id: comment.id, parent_id: comment.parent_id, resource_id: resourceId },
				_.omit(comment, ['id'])
			)
		)

		// Handle creating comments in bulk
		const createPromise =
			commentsToCreate.length > 0 ? commentQueries.bulkCreate(commentsToCreate) : Promise.resolve()

		await Promise.all([...updatePromises, createPromise])
		return { success: true }
	} catch (error) {
		throw error
	}
}
/**
 * Check if the given parent ids are valid or not for the resource
 * @method
 * @name isParantCommentValid
 * @param {Array} parentIds - List of parent ids of the comments
 * @param {Integer} resourceId - Resource Id
 * @returns {Boolean} - Returns a true / false indicating if the parent id is a valid id for the resource.
 */
async function isParantCommentValid(parentIds, resourceId) {
	try {
		const filter = {
			id: { [Op.in]: parentIds },
			resource_id: resourceId,
		}
		const comments = await commentQueries.findAll(filter, ['id', 'resource_id'])

		// Create a Set of unique strings combining 'id' and 'resource_id' from the DB results
		const commentResourceMap = new Set(comments.map((comment) => `${comment.id}-${comment.resource_id}`))

		// Loop through the filter array and check if each combination exists in the Set
		for (const parentId of parentIds) {
			const key = `${parentId}-${resourceId}`
			if (!commentResourceMap.has(key)) {
				return false // Return false if any combination is missing
			}
		}
		return true // Return true if all combinations are found
	} catch (error) {
		throw error
	}
}

// Export the handleComments function
module.exports.handleComments = handleComments

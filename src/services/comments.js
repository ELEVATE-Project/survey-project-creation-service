/**
 * name : services/comments.js
 * author : Priyanka Pradeep
 * Date : 11-July-2024
 * Description : Comment Service
 */
const httpStatusCode = require('@generics/http-status')
const commentQueries = require('@database/queries/comments')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const _ = require('lodash')
const reviewsQueries = require('@database/queries/reviews')
const reviewResourceQueries = require('@database/queries/reviewResources')
const { Op } = require('sequelize')
const activityService = require('@services/activities')
const resourceQueries = require('@database/queries/resources')
module.exports = class CommentsHelper {
	/**
	 * Comment Create or Update
	 * @method
	 * @name update
	 * @param {Integer} commentId - Comment ID
	 * @param {Integer} resourceId - Resource ID
	 * @param {Object} bodyData - Request Body
	 * @param {String} userId - User ID
	 * @param {String} orgId - Organization ID
	 * @returns {JSON} - comment id
	 */
	static async update(commentId = '', resourceId, bodyData, userId, orgId) {
		try {
			//validate resource
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
				},
				{ attributes: ['id', 'type', 'status'] }
			)

			if (!resource?.id) {
				throw new Error('RESOURCE_NOT_FOUND')
			}

			//validate resource status
			if (_commentRestrictedStatuses.includes(resource.status)) {
				throw new Error(`Resource is already ${resource.status}. You can't add comment`)
			}

			//create the comment
			if (!commentId) {
				bodyData.user_id = userId
				bodyData.resource_id = resourceId
				let commentCreate = await commentQueries.create(bodyData)

				//update the review as inprogress if its already started
				const reviewResource = await reviewResourceQueries.findOne({
					reviewer_id: userId,
					resource_id: resourceId,
				})

				if (reviewResource?.id) {
					const updatedCount = await reviewsQueries.update(
						{
							organization_id: reviewResource.organization_id,
							resource_id: resourceId,
							reviewer_id: userId,
							status: { [Op.in]: [common.REVIEW_STATUS_STARTED] },
						},
						{ status: common.REVIEW_STATUS_INPROGRESS }
					)

					if (updatedCount > 0) {
						//add user action
						await activityService.addUserAction(
							common.USER_ACTIONS[resource.type].REVIEW_INPROGRESS,
							userId,
							resourceId,
							common.MODEL_NAMES.RESOURCE,
							orgId
						)
					}
				}

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'COMMENT_UPDATED_SUCCESSFULLY',
					result: commentCreate,
				})
			}

			//update the comment
			if (bodyData.status === common.STATUS_RESOLVED) {
				bodyData.resolved_by = userId
				bodyData.resolved_at = new Date()
			}

			const filter = {
				resource_id: resourceId,
				id: commentId,
			}

			const [updateCount, updatedComment] = await commentQueries.updateOne(filter, bodyData, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				throw new Error('COMMENT_NOT_FOUND')
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message:
					bodyData.status === common.STATUS_RESOLVED ? 'COMMENT_RESOLVED' : 'COMMENT_UPDATED_SUCCESSFULLY',
				result: updatedComment,
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
	 * Comment list
	 * @method
	 * @name list
	 * @param {Integer} resourceId - Resource ID
	 * @param {String} pageValue - Page number or name
	 * @param {String} userId - User ID
	 * @param {String} orgId - Organization ID
	 * @param {String} context - Context page or tag
	 * @returns {JSON} - comment list
	 */
	static async list(resourceId, pageValue = '', context = '', userId, orgId) {
		try {
			let result = {
				resource_id: resourceId,
				commented_by: [],
				comments: [],
				count: 0,
			}

			//get all comments
			const comments = await commentQueries.list(resourceId, userId, pageValue, context)

			if (comments.count <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'COMMENT_FETCHED',
					result: result,
				})
			}

			//get commenter and resolver details
			const userIds = _.uniq(
				_.flatMap(comments.rows, (row) =>
					row.resolved_by !== null ? [row.resolved_by, row.user_id] : [row.user_id]
				)
			)

			const users = await userRequests.list(common.ALL_USER_ROLES, '', '', '', orgId, {
				user_ids: userIds,
			})

			let commented_by = []

			if (users.success && users.data?.result?.length > 0) {
				const user_map = _.keyBy(users.data.result, 'id')
				comments.rows = _.map(comments.rows, (comment) => {
					//add commenter and resolver details
					const commenter = user_map[comment.user_id] ? _.pick(user_map[comment.user_id], ['id', 'name']) : {}
					const resolver = comment.resolved_by
						? user_map[comment.resolved_by]
							? _.pick(user_map[comment.resolved_by], ['id', 'name'])
							: {}
						: {}

					// Add the commenter's name to the commented_by array if the name exists
					if (commenter.name) {
						commented_by.push(commenter.name)
					}

					return {
						...comment,
						commenter: commenter,
						resolver: resolver ? resolver : {},
					}
				})
			}

			result.comments = comments.rows
			result.commented_by = commented_by
			result.count = comments.count

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'COMMENT_FETCHED',
				result: result,
			})
		} catch (error) {
			throw error
		}
	}
}

/**
 * List of resource statuses that prevent for add comments.
 * @constant
 * @type {Array<String>}
 */
const _commentRestrictedStatuses = [
	common.RESOURCE_STATUS_REJECTED,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
	common.RESOURCE_STATUS_PUBLISHED,
	common.RESOURCE_STATUS_DRAFT,
]

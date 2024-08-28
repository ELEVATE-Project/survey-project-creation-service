/**
 * name : services/comments.js
 * author : Priyanka Pradeep
 * Date : 11-July-2024
 * Description : Review Stage Service
 */
const httpStatusCode = require('@generics/http-status')
const commentQueries = require('@database/queries/comments')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const _ = require('lodash')
const reviewsQueries = require('@database/queries/reviews')
const reviewResourceQueries = require('@database/queries/reviewResources')
const reviewsHelper = require('@services/reviews')
const { Op } = require('sequelize')
module.exports = class CommentsHelper {
	/**
	 * Comment Create or Update
	 * @method
	 * @name update
	 * @param {Integer} commentId - Comment ID
	 * @param {Integer} resourceId - Resource ID
	 * @param {Object} bodyData - Request Body
	 * @param {String} userId - User ID
	 * @returns {JSON} - comment id
	 */
	static async update(commentId = '', resourceId, bodyData, userId) {
		try {
			//create the comment
			if (!commentId) {
				// handle comments
				await reviewsHelper.handleComments(bodyData.comment, parseInt(resourceId, 10), userId)

				// convert body data to array if its not
				if (!Array.isArray(bodyData.comment)) {
					bodyData.comment = [bodyData.comment]
				}
				// check if any one comment is resolved or not
				const hasResolvedStatus = bodyData.comment.some((comment) => comment.status == common.STATUS_RESOLVED)

				// customize the return message , if comment is resolved or comment is updated
				const message = hasResolvedStatus ? 'COMMENT_RESOLVED' : 'COMMENT_UPDATED_SUCCESSFULLY'

				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message,
				})
			}

			//update the comment
			if (bodyData.comment.status === common.STATUS_RESOLVED) {
				bodyData.comment.resolved_by = userId
				bodyData.comment.resolved_at = new Date()
			}

			const filter = {
				resource_id: resourceId,
				id: commentId,
			}

			const [updateCount, updatedComment] = await commentQueries.updateOne(filter, bodyData.comment, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'COMMENT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message:
					bodyData.status === common.STATUS_RESOLVED ? 'COMMENT_RESOLVED' : 'COMMENT_UPDATED_SUCCESSFULLY',
				result: updatedComment,
			})
		} catch (error) {
			if (error.message == 'COMMENT_INVALID' || error.message == 'COMMENT_PARENT_INVALID') {
				return responses.failureResponse({
					message: error.message,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
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

			if (users.success && users.data?.result?.data?.length > 0) {
				const user_map = _.keyBy(users.data.result.data, 'id')
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

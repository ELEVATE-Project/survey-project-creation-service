const httpStatusCode = require('@generics/http-status')
const commentQueries = require('@database/queries/comments')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const _ = require('lodash')

module.exports = class ProjectsHelper {
	/**
	 * Comment Create or Update
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - comment id
	 */
	static async update(comment_id = '', resource_id, bodyData, loggedInUserId) {
		try {
			//create the comment
			if (!comment_id) {
				bodyData.user_id = loggedInUserId
				bodyData.resource_id = resource_id
				let commentCreate = await commentQueries.create(bodyData)
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'COMMENT_UPDATED_SUCCESSFULLY',
					result: commentCreate,
				})
			}

			//update the comment
			if (bodyData.status === common.STATUS_RESOLVED || !bodyData.resolved_by) {
				bodyData.resolved_by = loggedInUserId
				bodyData.resolved_at = new Date()
				bodyData.status = common.STATUS_RESOLVED
			}

			const filter = {
				id: comment_id,
				resource_id: resource_id,
			}

			const [updateCount, updatedComment] = await commentQueries.updateOne(filter, bodyData, {
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
			if (error.name === 'SequelizeDatabaseError' && error.original.code === '22P02') {
				return responses.failureResponse({
					message: 'STATUS_INVALID',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			} else {
				throw error
			}
		}
	}

	/**
	 * Comment list
	 * @method
	 * @name list
	 * @param {Object} req - request data.
	 * @returns {JSON} - comment list
	 */
	static async list(resource_id, page_value = '', context = '', loggedInUserId, organization_id) {
		try {
			let result = {
				resource_id: resource_id,
				commented_by: [],
				comments: [],
				count: 0,
			}

			//get all comments
			const comments = await commentQueries.commentList(resource_id, loggedInUserId, page_value, context)

			if (comments.count <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'COMMENT_FETCHED',
					result: result,
				})
			}

			//get commenter and resolver details
			const uniqueUserIds = _.uniq(
				_.flatMap(comments.rows, (row) =>
					row.resolved_by !== null ? [row.resolved_by, row.user_id] : [row.user_id]
				)
			)

			const users = await userRequests.list(common.ALL_USER_ROLES, '', '', '', organization_id, {
				user_ids: uniqueUserIds,
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

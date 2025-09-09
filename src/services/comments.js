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
const reviewsHelper = require('@services/reviews')
const resourceQueries = require('@database/queries/resources')
const programResourceMappingQueries = require('@database/queries/programResourceMapping')
const { Op, Sequelize } = require('sequelize')
module.exports = class CommentsHelper {
	/**
	 * Comment Create or Update
	 * @method
	 * @name update
	 * @param {Integer} commentId - Comment ID
	 * @param {Integer} resourceId - Resource ID
	 * @param {Object} bodyData - Request Body
	 * @param {String} userId - User ID
	 * @param {String} org_code - organization code
	 * @param {String} tenant_code - tenant code
	 * @returns {JSON} - comment id
	 */
	static async update(commentId = '', resourceId, bodyData, userId, org_code, tenant_code) {
		try {
			//validate resource
			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
					organization_code: org_code,
					tenant_code: tenant_code,
				},
				{ attributes: ['id', 'type', 'status', 'organization_code'] }
			)

			if (!resource?.id) {
				throw new Error('RESOURCE_NOT_FOUND')
			}

			//validate resource status
			if (_commentRestrictedStatuses.includes(resource.status)) {
				// Check if resource is associated with a program
				const associatedResources = await programResourceMappingQueries.findOne({
					resource_id: resourceId,
					organization_code: resource.organization_code,
					tenant_code: tenant_code,
				})

				//if the resource is a non program and attached to program still reviewer can add comment
				if (resource.type != common.RESOURCE_TYPE_PROGRAM && !associatedResources?.id) {
					throw new Error(`Resource is already ${resource.status}. You can't add comment`)
				}
			}

			//create the comment
			if (!commentId) {
				// handle comments
				await reviewsHelper.handleComments(
					bodyData.comment,
					parseInt(resourceId, 10),
					userId,
					'',
					resource.type,
					org_code,
					tenant_code
				)

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

			// convert comment.text to comment.comment as per DB schema
			bodyData.comment.comment = bodyData.comment.text
			delete bodyData.comment.text

			//update the comment
			if (bodyData.comment.status === common.STATUS_RESOLVED) {
				bodyData.comment.resolved_by = userId
				bodyData.comment.resolved_at = new Date()
			}

			const filter = {
				resource_id: resourceId,
				id: commentId,
				tenant_code: tenant_code,
				organization_code: org_code,
			}

			const [updateCount, updatedComment] = await commentQueries.update(filter, bodyData.comment, {
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
	 * Comment delete
	 * @method
	 * @name delete
	 * @param {Integer} commentId - Comment ID
	 * @param {Integer} resourceId - Resource ID
	 * @param {String} userId - User ID
	 * @param {String} org_code - organization code
	 * @param {String} tenant_code - tenant code
	 * @returns {JSON}
	 */
	static async delete(commentId, resourceId, userId, org_code, tenant_code) {
		try {
			// soft delete comment
			await commentQueries.deleteOne(commentId, resourceId, userId, org_code, tenant_code)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'COMMENT_DELETED',
				result: {},
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
	 * @param {String} context - Context page or tag
	 * @param {String} userId - User ID
	 * @param {String} org_code - organization id
	 * @param {String} tenant_code - tenant code
	 * @param {String} userToken - User token
	 * @returns {JSON} - comment list
	 */
	static async list(resourceId, pageValue = '', context = '', userId, org_code, tenant_code, userToken = '') {
		try {
			let result = {
				resource_id: resourceId,
				commented_by: [],
				comments: [],
				count: 0,
			}

			//get all comments
			const comments = await commentQueries.list(resourceId, userId, pageValue, context, org_code, tenant_code)

			// Check if the resource is of type 'program' and fetch child resources
			let resource = await resourceQueries.findOne(
				{
					id: resourceId,
					organization_code: org_code,
					tenant_code: tenant_code,
				},
				{ attributes: ['id', 'type', 'organization_code'] }
			)

			if (resource?.type === common.RESOURCE_TYPE_PROGRAM) {
				result.childResources = []
				// Fetch all resources associated with the given program
				const associatedResources = await programResourceMappingQueries.findAll({
					program_id: resourceId,
					organization_code: resource.organization_code,
					tenant_code: tenant_code,
				})

				// If there are associated resources, proceed with fetching their comments
				if (associatedResources?.length > 0) {
					const resourceIds = associatedResources.map((resource) => resource.resource_id)

					// Fetch count of open comments for each associated resource
					const associatedResourceComments = await commentQueries.findAll(
						{
							resource_id: { [Op.in]: resourceIds },
							status: common.COMMENT_STATUS_DRAFT,
							organization_code: resource.organization_code,
							tenant_code: tenant_code,
						},
						['resource_id', [Sequelize.literal('COUNT(id)'), 'count']],
						{ group: ['resource_id'] }
					)

					// Add childResources data only if there are comments
					if (associatedResourceComments.length > 0) {
						result.childResources = associatedResourceComments.map((comment) => ({
							resource_id: comment.resource_id,
							is_comments: comment.count > 0,
							count: comment.count,
						}))
					}
				}
			}
			if (comments.count <= 0 || !resource?.id) {
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

			const users = await userRequests.list(
				common.ALL_USER_ROLES,
				'',
				'',
				'',
				org_code,
				tenant_code,
				{
					user_ids: userIds,
				},
				userToken
			)

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
			result.commented_by = _.uniq(commented_by)
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
 * List of Statuses Restricting Comment Addition
 * @constant
 * @type {Array<String>}
 */
const _commentRestrictedStatuses = [
	common.RESOURCE_STATUS_REJECTED,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
	common.RESOURCE_STATUS_PUBLISHED,
	common.RESOURCE_STATUS_DRAFT,
]

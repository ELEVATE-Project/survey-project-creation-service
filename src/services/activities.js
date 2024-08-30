/**
 * name : services/activities.js
 * author : Priyanka Pradeep
 * Date : 13-Aug-2024
 * Description : Activities Service
 */
const httpStatusCode = require('@generics/http-status')
const activitiesQueries = require('@database/queries/activities')
const responses = require('@helpers/responses')
const { activityDTO } = require('@dtos/activity')
const common = require('@constants/common')
module.exports = class ActivityHelper {
	/**
	 * list activities.
	 * @method
	 * @name list
	 * @param {Integer} resourceId - The ID of the resource for which activities are listed.
	 * @param {String} userId - Id of the logged in user
	 * @param {Integer} page - Page number
	 * @param {Integer} page - Page size limit
	 * @param {String} search - Search text.
	 * @returns {JSON} - activities list response.
	 */

	static async list(resourceId, userId, orgId, page, limit) {
		try {
			if (!resourceId) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'RESOURCE_ID_REQUIRED',
				})
			}

			let result = {
				data: [],
				count: 0,
			}

			const offset = common.getPaginationOffset(page, limit)
			const options = {
				offset,
				limit,
			}

			let filter = {
				organization_id: orgId.toString(),
				object_id: resourceId,
			}

			const attributes = ['id', 'action_id', 'user_id', 'object_id', 'object_type', 'created_at']
			//fetch all the activities
			const activities = await activitiesQueries.findAllActivities(filter, attributes, options)
			if (activities.count <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ACTIVITIES_FETCHED',
					result: result,
				})
			}

			// Format each user activity into a readable form
			const formatActivities = await activityDTO(activities.rows, orgId, userId)
			if (formatActivities.success) {
				result.data = formatActivities
				result.count = activities.count
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ACTIVITIES_FETCHED',
				result: result,
			})
		} catch (error) {
			throw error
		}
	}
}

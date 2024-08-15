/**
 * name : services/activities.js
 * author : Priyanka Pradeep
 * Date : 13-Aug-2024
 * Description : Activities Service
 */
const httpStatusCode = require('@generics/http-status')
const activitiesQueries = require('@database/queries/activities')
const actionQueries = require('@database/queries/actions')
const responses = require('@helpers/responses')
module.exports = class ActivityHelper {
	/**
	 * Add activity of user
	 * @method
	 * @name addUserAction
	 * @param {String} action - action
	 * @param {String} userId - User ID
	 * @param {String} objectId - Ex: Resource ID
	 * @param {String} objectType - Ex: Resource
	 * @param {String} orgId - User Organization ID
	 * @returns {JSON} - activity create response
	 */
	static async addUserAction(actionCode, userId, objectId, objectType, orgId) {
		try {
			//check action exist
			const action = await actionQueries.findOne({ code: actionCode })
			if (!action?.id) {
				throw new Error('ACTION_NOT_FOUND')
			}

			const activityData = {
				action_id: action.id,
				user_id: userId,
				object_id: objectId,
				object_type: objectType,
				organization_id: orgId,
			}

			const createActivity = await activitiesQueries.create(activityData)
			if (!createActivity?.id) {
				throw new Error('ACTIVITY_CREATION_FAILED')
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ACTIVITY_CREATED',
			})
		} catch (error) {
			throw error
		}
	}
}

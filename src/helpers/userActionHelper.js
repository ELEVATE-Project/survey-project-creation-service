const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const actionQueries = require('@database/queries/actions')
const activitiesQueries = require('@database/queries/activities')

module.exports = class UserActionHelper {
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
				return responses.failureResponse({
					message: 'ACTION_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const activityData = {
				action_id: action.id,
				user_id: userId,
				object_id: objectId,
				object_type: objectType,
				organization_code: orgId,
			}

			//create the activity
			const createActivity = await activitiesQueries.create(activityData)
			if (!createActivity?.id) {
				return responses.failureResponse({
					message: 'ACTIVITY_CREATION_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ACTIVITY_CREATED',
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

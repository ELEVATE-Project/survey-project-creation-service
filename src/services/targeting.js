/**
 * name : targeting.js
 * author : Adithya Dinesh
 * created-date : 31-Oct-2025
 * Description : Targeting Helper.
 */
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const utils = require('@generics/utils')
const endpoints = require('@constants/endpoints')
const requests = require('@generics/requests')

module.exports = class targetingService {
	/**
	 * targetingSubEntityList
	 * @method
	 * @name targetingSubEntityList
	 * @param {String} parentId - parent external id.
	 * @param {String} token - user token
	 * @returns {JSON} - rollout id
	 */
	static async targetingSubEntityList(parentId, token) {
		let result = {}
		try {
			const baseUrl = utils.buildUrl(
				process.env.ENTITY_MANAGEMENT_SERVICE_HOST,
				process.env.ENTITY_MANAGEMENT_SERVICE_NAME
			)
			const endpoint = utils.buildUrl(baseUrl, endpoints.SUB_ENTITY_LISTBASED_ON_ROLE_AND_LOCATION, {}, parentId)

			const entityResponse = await requests.get(endpoint, token)

			if (
				!entityResponse ||
				entityResponse.data.status != httpStatusCode.ok ||
				entityResponse?.data?.result?.length == 0
			) {
				return responses.failureResponse({
					message: 'FAILED_TO_FETCH_ENTITY_TYPES',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			const findEntity = entityResponse?.data?.result?.find(
				(entity) => entity?.metaInformation?.externalId.toString() === parentId.toString()
			)
			const parentEntityType = findEntity?.entityType || null

			result = findEntity
			if (result?.childHierarchyPath && result.childHierarchyPath.length > 0) {
				result.childHierarchyPath = [parentEntityType, ...result.childHierarchyPath].filter(
					(item) => item !== null
				)
			} else {
				result.childHierarchyPath = [parentEntityType].filter((item) => item !== null)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ENTITY_TYPE_FETCHED_SUCCESSFULLY',
				result: result,
			})
		} catch (error) {
			return responses.failureResponse({
				message: 'FAILED_TO_FETCH_ENTITY_TYPES',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

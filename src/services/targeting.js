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
const common = require('@constants/common')

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
			const endpoint = fetchBaseUrl(endpoints.SUB_ENTITY_LISTBASED_ON_ROLE_AND_LOCATION, {}, parentId)

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
	/**
	 * targetingSubEntityList
	 * @method
	 * @name targetingSubEntityList
	 * @param {String} parentId - parent external id.
	 * @param {String} token - user token
	 * @returns {JSON} - rollout id
	 */
	static async fetchDependedSubEntities(subEntity, parentEntities, tenantCode, pageNo = 1, pageSize = 100) {
		let result = []
		try {
			const endpoint = fetchBaseUrl(endpoints.FIND_ENTITIES_BY_QUERY)
			parentEntities =
				typeof parentEntities == common.STRING
					? parentEntities
							.split(',')
							.map((item) => item.trim())
							.filter((item) => item !== '')
					: parentEntities.map((item) => item.trim()).filter((item) => item !== '')

			const fetchParentBody = {
				query: {
					'metaInformation.externalId': { $in: parentEntities },
					tenantId: tenantCode,
				},
				projection: ['groups'],
			}

			const entityResponse = await requests.post(
				endpoint,
				fetchParentBody,
				'',
				true,
				common.INTERNAL_ACCESS_TOKEN
			)

			if (
				!entityResponse ||
				entityResponse.data.status != httpStatusCode.ok ||
				entityResponse?.data?.result?.length == 0
			) {
				return responses.failureResponse({
					message: 'FAILED_TO_FETCH_ENTITIES',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const entitySubEntityMap = transformEntityResponse(entityResponse)
			const subEntityList = [...new Set(entitySubEntityMap[subEntity] || [])]
			if (subEntityList.length != 0) {
				const fetchSubEntityBody = {
					query: {
						_id: { $in: subEntityList },
						tenantId: tenantCode,
					},
					projection: ['metaInformation'],
					mongoIdKeys: ['_id'],
				}

				const subEntityEndpoint = fetchBaseUrl(endpoints.FIND_ENTITIES_BY_QUERY, {
					page: pageNo,
					limit: pageSize,
				})
				const subEntityResponse = await requests.post(
					subEntityEndpoint,
					fetchSubEntityBody,
					'',
					true,
					common.INTERNAL_ACCESS_TOKEN
				)

				if (
					subEntityResponse &&
					subEntityResponse.data.status == httpStatusCode.ok &&
					subEntityResponse?.data?.result?.length > 0
				) {
					result =
						subEntityResponse?.data?.result.map((item) => {
							return {
								_id: item?._id,
								name: item?.metaInformation.name,
								externalId: item?.metaInformation.externalId,
							}
						}) || []
				}
			}

			return responses.successResponse({
				message: 'ENTITIES_FETCHED_SUCCESSFULLY',
				statusCode: httpStatusCode.ok,
				result: result,
			})
		} catch (error) {
			return responses.failureResponse({
				message: 'FAILED_TO_FETCH_ENTITIES',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

function fetchBaseUrl(endPoint, queryParams = {}, id = '') {
	const baseUrl = utils.buildUrl(
		process.env.ENTITY_MANAGEMENT_SERVICE_HOST,
		process.env.ENTITY_MANAGEMENT_SERVICE_NAME
	)
	return utils.buildUrl(baseUrl, endPoint, queryParams, id)
}

/**
 * Transforms the entity response into a map where each key from "groups"
 * maps to a single, flat array of all its associated IDs.
 *
 * @param {object} response - The input response object.
 * @returns {object} - The transformed map (entitySubEntityMap).
 */
function transformEntityResponse(response) {
	// Check for valid input structure
	if (!response || !response.data || !Array.isArray(response.data.result)) {
		console.error('Invalid input structure. Expected response.data.result to be an array.')
		return {}
	}

	// Use reduce to build the final map (our accumulator 'acc')
	const entitySubEntityMap = response.data.result.reduce((acc, currentItem) => {
		// Ensure the 'groups' object exists and is not null
		if (currentItem && typeof currentItem.groups === 'object' && currentItem.groups !== null) {
			// Iterate over each key in the 'groups' object (e.g., "professional_subroles", "subEntity")
			for (const groupKey in currentItem.groups) {
				// Check if the key is a direct property and its value is an array
				if (
					Object.hasOwnProperty.call(currentItem.groups, groupKey) &&
					Array.isArray(currentItem.groups[groupKey])
				) {
					// Get the array of IDs
					const idArray = currentItem.groups[groupKey]

					// If this groupKey isn't in our accumulator map yet, initialize it as an empty array
					if (!acc[groupKey]) {
						acc[groupKey] = []
					}

					// Add the items from the current idArray to the main array for that groupKey
					// Using push with spread operator (...) is efficient
					acc[groupKey].push(...idArray)
				}
			}
		}

		// Return the updated accumulator for the next iteration
		return acc
	}, {}) // Start with an empty object {} as the initial value for the accumulator

	return entitySubEntityMap
}

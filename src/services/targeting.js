/**
 * name : targeting.js
 * author : Adithya Dinesh
 * created-date : 31-Oct-2025
 * Description : Targeting Helper.
 */
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const interfaceRequest = require('@requests/interface')
const { transformEntityDTO } = require('@dtos/targeting')

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
			const entityResponse = await interfaceRequest.hierarchyFetch({}, parentId, token)

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
	 * Fetches dependent sub-entities based on parent entities
	 * @method
	 * @name fetchDependedSubEntities
	 * @param {String} subEntity - sub entity type to fetch
	 * @param {String|Array} parentEntities - parent entity external ids
	 * @param {String} tenantCode - tenant code
	 * @param {Number} [pageNo=1] - page number for pagination
	 * @param {Number} [pageSize=100] - page size for pagination
	 * @returns {JSON} - List of sub entities with count
	 */
	static async fetchDependedSubEntities(subEntity, parentEntities, tenantCode, pageNo = 1, pageSize = 100) {
		let result = [],
			count = 0
		try {
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

			const entityResponse = await interfaceRequest.entityFind(fetchParentBody)

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

			const entitySubEntityMap = transformEntityDTO(entityResponse)
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

				const subEntityResponse = await interfaceRequest.entityFind(fetchSubEntityBody, {
					page: pageNo,
					limit: pageSize,
				})

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
					count = subEntityResponse?.data?.count || 0
				}
			}

			return responses.successResponse({
				message: 'ENTITIES_FETCHED_SUCCESSFULLY',
				statusCode: httpStatusCode.ok,
				result: { data: [...result], count },
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

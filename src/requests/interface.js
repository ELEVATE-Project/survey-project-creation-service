/**
 * name : interface.js
 * author : Adithya Dinesh
 * Date : 20 - Aug - 2024
 * Description : Internal calls to elevate-interface service.
 */

// Dependencies
const interfaceBaseUrl = process.env.INTERFACE_SERVICE_HOST
const requests = require('@generics/requests')
const endpoints = require('@constants/endpoints')
const utils = require('@generics/utils')
const common = require('@constants/common')
const entityManagementBaseUrl = utils.buildUrl(interfaceBaseUrl, process.env.ENTITY_MANAGEMENT_SERVICE_NAME)

/**
 * browse Existing resources List
 * @method
 * @name browseExistingList
 * @param {String} resourceType - Type of resources
 * @param {String} organization_code - Organization id of the user.
 * @param {String} token - bearer auth token of the user.
 * @param {String} searchText - search field.
 * @returns {JSON} - List of resources
 */

const browseExistingList = function (resourceType = '', organization_code = null, token = '', searchText = '') {
	return new Promise(async (resolve, reject) => {
		try {
			const internalAccessToken = true
			let body = {
				resourceType: resourceType ? resourceType.split(',') : [],
			}

			const apiUrl = utils.buildUrl(interfaceBaseUrl, endpoints.BROWSE_EXISTING_END_POINT)

			if (searchText != '') body.search = searchText
			if (organization_code != null) body.organization_code = organization_code

			const resourceList = await requests.post(apiUrl, body, token, internalAccessToken)

			return resolve(resourceList)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Read entity types from external service
 * @method
 * @name entityDbFind
 * @param {Object} bodyData - Request body data
 * @param {String} token - auth token of the user
 * @returns {JSON} - Entity types data
 */
const entityDbFind = function (organization_code, tenant_code, token = '') {
	return new Promise(async (resolve, reject) => {
		try {
			let data = {
				query: {
					// orgId: { $in: [organization_code, common.ALL] }, //commenting hence the entity management removing orgId filter
					tenantId: tenant_code,
					isObservable: true,
				},
				projection: ['_id', 'name'],
			}

			const apiUrl = utils.buildUrl(entityManagementBaseUrl, endpoints.ENTITY_TYPES_READ)
			const result = await requests.post(apiUrl, data, '', true, common.INTERNAL_ACCESS_TOKEN)
			return resolve(result)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Maps users to a program.
 * @param {Object} data - Mapping data (users, programId, operation, roles).
 * @param {String} organizationCode - Organization code.
 * @param {String} tenantCode - Tenant code.
 * @param {String|null} userId - User ID performing the mapping.
 * @returns {Promise<Object>} - API response.
 */
const mapUserAndProgram = function (data = {}, organizationCode, tenantCode, userId = null) {
	return new Promise(async (resolve, reject) => {
		try {
			let queryParams = {
				tenantId: tenantCode,
				orgId: organizationCode,
			}

			if (userId) {
				queryParams.userId = userId
			}

			let body = {
				data: data,
			}

			const apiUrl = utils.buildUrl(
				interfaceBaseUrl + process.env.CONSUMPTION_SERVICE_BASE_URL,
				endpoints.MAP_USER_AND_PROGRAM,
				queryParams
			)
			const response = await requests.post(apiUrl, body, '', true, 'internal-access-token')
			return resolve(response)
		} catch (error) {
			return reject(error)
		}
	})
}

const entityFind = async function (body, queryParams = {}, id = '') {
	const endpoint = utils.buildUrl(entityManagementBaseUrl, endpoints.FIND_ENTITIES_BY_QUERY, queryParams, id)
	const entityResponse = await requests.post(endpoint, body, '', true, common.INTERNAL_ACCESS_TOKEN)
	return entityResponse
}
const hierarchyFetch = async function (queryParams = {}, id = '', token = '') {
	const endpoint = utils.buildUrl(
		entityManagementBaseUrl,
		endpoints.SUB_ENTITY_LISTBASED_ON_ROLE_AND_LOCATION,
		queryParams,
		id
	)
	const entityResponse = await requests.get(endpoint, token)
	return entityResponse
}

module.exports = {
	browseExistingList,
	entityDbFind,
	mapUserAndProgram,
	entityFind,
	hierarchyFetch,
}

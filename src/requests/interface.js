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
const entityManagementBaseUrl = interfaceBaseUrl + process.env.ENTITY_MANAGEMENT_SERVICE_NAME

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
			const result = await requests.post(apiUrl, data, '', true, 'internal-access-token')
			return resolve(result)
		} catch (error) {
			return reject(error)
		}
	})
}

module.exports = {
	browseExistingList,
	entityDbFind,
}

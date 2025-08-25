/**
 * name : user.js
 * author : Adithya Dinesh
 * Date : 20 - Aug - 2024
 * Description : Internal calls to elevate-interface service.
 */

// Dependencies
const interfaceBaseUrl = process.env.INTERFACE_SERVICE_HOST
const requests = require('@generics/requests')
const endpoints = require('@constants/endpoints')
const utils = require('@generics/utils')

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

module.exports = {
	browseExistingList,
}

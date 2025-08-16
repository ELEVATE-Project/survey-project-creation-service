/**
 * name : user.js
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : Internal calls to elevate-user service.
 */

// Dependencies
const userBaseUrl = process.env.USER_SERVICE_HOST + process.env.USER_SERVICE_BASE_URL
const requests = require('@generics/requests')
const endpoints = require('@constants/endpoints')
const request = require('request')

/**
 * Fetches the default organization details for a given organization code/id.
 * @param {string} organisationIdentifier - The code/id of the organization.
 * @returns {Promise} A promise that resolves with the organization details or rejects with an error.
 */

const fetchOrg = function (organisationIdentifier, tenantCode, internalToken = true) {
	return new Promise(async (resolve, reject) => {
		try {
			if (!organisationIdentifier || !tenantCode) {
				throw new Error('Organisation identifier and tenant code are required')
			}
			const isNumericId = !isNaN(organisationIdentifier) && !isNaN(parseFloat(organisationIdentifier))
			const queryParam = isNumericId ? 'organisation_id' : 'organisation_code'

			// Build URL with query parameters
			const orgReadUrl = `${userBaseUrl}${endpoints.ORGANIZATION_READ}?${queryParam}=${organisationIdentifier}&tenant_code=${tenantCode}`

			const orgDetails = await requests.get(
				orgReadUrl,
				'', // X-auth-token not required for internal call
				internalToken
			)

			return resolve(orgDetails)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * User profile details.
 * @method
 * @name details
 * @param {String} [token =  ""] - token information.
 * @param {String} [userId =  ""] - user id.
 * @returns {JSON} - User profile details.
 */

const details = function (token = '', userId = '') {
	return new Promise(async (resolve, reject) => {
		try {
			let profileUrl = userBaseUrl + endpoints.USER_PROFILE_DETAILS
			let internalToken = true // All internal api calls require internal access token

			if (userId != '') {
				profileUrl = profileUrl + '/' + userId
			}
			const profileDetails = await requests.get(profileUrl, token, internalToken)
			return resolve(profileDetails)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Get Accounts details.
 * @method
 * @name getAllAccountsDetail
 * @param {Array} userIds
 * @returns
 */

/**
 * User list.
 * @method
 * @name list
 * @param {Boolean} userType - reviewer/content_creator.
 * @param {Number} page - page No.
 * @param {Number} limit - page limit.
 * @param {String} search - search field.
 * @returns {JSON} - List of users
 */

const list = function (
	userType,
	pageNo = '',
	pageSize = '',
	searchText = '',
	organization_code = null,
	body = {},
	userToken = '',
	tenantCode = null
) {
	return new Promise(async (resolve, reject) => {
		try {
			let apiUrl = userBaseUrl + endpoints.USERS_LIST + '?type=' + userType
			if (pageNo != '') apiUrl += '&page=' + pageNo
			if (pageSize != '') apiUrl += '&limit=' + pageSize
			if (searchText != '') apiUrl += '&search=' + searchText
			if (organization_code != null) apiUrl += '&organization_code=' + organization_code
			if (tenantCode) apiUrl += '&tenant_code=' + tenantCode

			const userDetails = await requests.post(apiUrl, body, userToken, true)
			return resolve(userDetails)
		} catch (error) {
			return reject(error)
		}
	})
}

const read = function (userId, userToken = '') {
	return new Promise(async (resolve, reject) => {
		try {
			let apiUrl = userBaseUrl + endpoints.USER_PROFILE_DETAILS + userId
			const userDetails = await requests.get(apiUrl, userToken, false)
			return resolve(userDetails)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * User Role list.
 * @method
 * @name defaultList
 * @param {Number} page - page No.
 * @param {Number} limit - page limit.
 * @param {String} search - search field.
 * @returns {JSON} - List of roles
 */

const getListOfUserRoles = async (page, limit, search) => {
	const options = {
		headers: {
			'Content-Type': 'application/json',
			internal_access_token: process.env.INTERNAL_ACCESS_TOKEN,
		},
		json: true,
	}

	const apiUrl = userBaseUrl + endpoints.USERS_ROLE_LIST + `?page=${page}&limit=${limit}&search=${search}`

	try {
		const data = await new Promise((resolve, reject) => {
			request.get(apiUrl, options, (err, response) => {
				if (err) {
					reject({
						message: 'USER_SERVICE_DOWN',
						error: err,
					})
				} else {
					try {
						resolve(response.body)
					} catch (parseError) {
						reject({
							message: 'Failed to parse JSON response',
							error: parseError,
						})
					}
				}
			})
		})

		return data
	} catch (error) {
		throw error
	}
}

/**
 * User list.
 * @method
 * @name list
 * @param {Boolean} userType - mentor/mentee.
 * @param {Number} page - page No.
 * @param {Number} limit - page limit.
 * @param {String} search - search field.
 * @returns {JSON} - List of users
 */

const listWithoutLimit = function (userType, searchText) {
	return new Promise(async (resolve, reject) => {
		try {
			const apiUrl = userBaseUrl + endpoints.USERS_LIST + '?type=' + userType + '&search=' + searchText
			const userDetails = await requests.get(apiUrl, false, true)

			return resolve(userDetails)
		} catch (error) {
			return reject(error)
		}
	})
}
const search = function (userType, pageNo, pageSize, searchText, userServiceQueries) {
	let userSearchBody = {}
	// queryParams to search in user service. Like user_ids , name , email etc...
	if (userServiceQueries) {
		for (const [key, value] of Object.entries(userServiceQueries)) {
			userSearchBody[key] = value
		}
	}
	return new Promise(async (resolve, reject) => {
		try {
			const apiUrl =
				userBaseUrl +
				endpoints.USERS_LIST +
				'?type=' +
				userType +
				'&page=' +
				pageNo +
				'&limit=' +
				pageSize +
				'&search=' +
				searchText
			const userDetails = await requests.post(apiUrl, { ...userSearchBody }, '', true)

			return resolve(userDetails)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Get Organization list.
 * @method
 * @name listOrganization
 * @param {Array} organizationIds
 * @returns
 */

const listOrganization = function (organizationIds = [], userToken = '') {
	return new Promise(async (resolve, reject) => {
		try {
			const apiUrl = userBaseUrl + endpoints.ORGANIZATION_LIST
			let body = {}
			if (organizationIds) {
				body.organizationIds = organizationIds
			}

			const orgDetails = await requests.post(apiUrl, body, userToken, true)
			return resolve(orgDetails)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Fetches tenant details for a given tenant code.
 * @param {string} tenantCode - The code of the tenant.
 * @returns {Promise} A promise that resolves with the tenant details or rejects with an error.
 */
const fetchTenant = function (tenantCode) {
	return new Promise(async (resolve, reject) => {
		try {
			const tenantReadUrl = `${userBaseUrl}${endpoints.TENANT_READ}/${tenantCode}`
			const internalToken = true

			const tenantDetails = await requests.get(
				tenantReadUrl,
				'', // X-auth-token not required for internal call
				internalToken
			)
			return resolve(tenantDetails)
		} catch (error) {
			return reject(error)
		}
	})
}

module.exports = {
	fetchOrg,
	details,
	list,
	listWithoutLimit,
	search,
	getListOfUserRoles,
	listOrganization,
	read,
	fetchTenant,
}

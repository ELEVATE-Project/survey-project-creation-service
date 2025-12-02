/**
 * name : generics/requests
 * author : Priyanka Pradeep
 * Date : 29 - April - 2024
 * Description : Generic request methods
 */
const request = require('request')
const parser = require('xml2json')
const httpStatusCode = require('@generics/http-status')

var get = function (
	url,
	token = '',
	internal_access_token = false,
	internalAccessTokenKey = 'internal_access_token',
	additionalHeaders = {}
) {
	return new Promise((resolve, reject) => {
		try {
			let headers = {
				'content-type': 'application/json',
				...(additionalHeaders || {}), // Safe against null/undefined
				...(internal_access_token && { [internalAccessTokenKey]: process.env.INTERNAL_ACCESS_TOKEN }),
				...(token && { [process.env.AUTH_TOKEN_HEADER_NAME]: token }),
			}

			const options = {
				headers: headers,
			}

			request.get(url, options, (err, data) => {
				let result = {
					success: true,
				}

				if (err) {
					result.success = false
				} else {
					let response = data.body
					if (data.headers['content-type'].split(';')[0] !== 'application/json') {
						response = parser.toJson(data.body)
					} else if (/text\/xml|application\/xml/.test(data.headers['content-type'])) {
						response = parser.toJson(response, { object: true })
					}

					response = JSON.parse(response)
					result.data = response
				}

				return resolve(result)
			})
		} catch (error) {
			return reject(error)
		}
	})
}

var post = function (
	url,
	body,
	token = '',
	internal_access_token = false,
	internalAccessTokenKey = 'internal_access_token',
	admin_access_token = false,
	adminAuthTokenKey = 'admin_auth_token'
) {
	return new Promise((resolve, reject) => {
		try {
			let headers = {
				'content-type': 'application/json',
			}
			if (internal_access_token) {
				headers[internalAccessTokenKey] = process.env.INTERNAL_ACCESS_TOKEN
			}

			if (token) {
				headers[process.env.AUTH_TOKEN_HEADER_NAME] = token
			}
			if (admin_access_token) {
				headers[adminAuthTokenKey] = process.env.ADMIN_ACCESS_TOKEN
			}

			const options = {
				headers: headers,
				body: JSON.stringify(body),
			}

			request.post(url, options, (err, data) => {
				let result = {
					success: true,
				}

				if (err) {
					result.success = false
				} else {
					let response = data.body
					if (data.headers['content-type'].split(';')[0] !== 'application/json') {
						response = parser.toJson(data.body)
					} else if (/text\/xml|application\/xml/.test(data.headers['content-type'])) {
						response = parser.toJson(response, { object: true })
					}

					response = JSON.parse(response)
					result.data = response
				}

				return resolve(result)
			})
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * PUT request
 * @param {String} url - Endpoint URL
 * @param {Object|Buffer} bodyData - Data to send (JSON or multipart)
 * @param {String} token - Optional auth token
 * @param {Boolean} internal_access_token - Use internal access token
 * @param {String} internalAccessTokenKey - Header key for internal token
 * @param {String} contentType - Optional content type, defaults to JSON
 * @returns {Promise<Object>}
 */
const put = function (
	url,
	bodyData,
	token = '',
	internal_access_token = false,
	internalAccessTokenKey = 'internal_access_token',
	contentType = 'application/json'
) {
	return new Promise((resolve, reject) => {
		try {
			// Prepare headers
			const headers = { 'Content-Type': contentType }
			if (internal_access_token) headers[internalAccessTokenKey] = process.env.INTERNAL_ACCESS_TOKEN
			if (token) headers[process.env.AUTH_TOKEN_HEADER_NAME] = token

			// Request options
			const options = {
				url,
				method: 'PUT',
				headers,
				body: contentType.includes('json') ? JSON.stringify(bodyData) : bodyData,
			}

			request(options, (err, res, body) => {
				if (err) {
					return resolve({
						success: false,
						statusCode: res?.statusCode || httpStatusCode.internal_server_error,
						error: err.message || err,
					})
				}

				let responseBody = body
				try {
					if (res.headers['content-type']) {
						const ct = res.headers['content-type'].split(';')[0]
						if (ct === 'application/json') {
							responseBody = JSON.parse(body)
						} else if (/text\/xml|application\/xml/.test(ct)) {
							responseBody = parser.toJson(body, { object: true })
						}
					}
				} catch (parseError) {
					// Ignore parse errors, return raw body
				}

				resolve({
					success: true,
					statusCode: res.statusCode,
					data: responseBody,
				})
			})
		} catch (error) {
			reject({ success: false, error: error.message || error })
		}
	})
}

module.exports = {
	get: get,
	post: post,
	put: put,
}

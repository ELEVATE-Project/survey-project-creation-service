/**
 * name : generics/requests
 * author : Priyanka Pradeep
 * Date : 29 - April - 2024
 * Description : Generic request methods
 */
const request = require('request')
const parser = require('xml2json')
const common = require('@constants/common')

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
	internalAccessTokenKey = 'internal_access_token'
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
 * Upload a file to cloud storage using a pre-signed URL.
 * @method
 * @name put
 * @param {String} fileUploadUrl - Pre-signed URL for uploading the file.
 * @param {Buffer|Stream|String} fileData - File data to upload.
 *   - Buffer: binary file data (e.g., from fs.readFileSync).
 *   - Stream: readable stream (e.g., from fs.createReadStream).
 *   - String: raw text data.
 * @returns {Promise<Object>} - Response with statusCode, headers, and body.
 */
var put = function (fileUploadUrl, fileData) {
	return new Promise((resolve, reject) => {
		try {
			request(
				{
					url: fileUploadUrl,
					method: common.PUT,
					headers: {
						'Content-Type': 'application/multipart/form-data', // cloud storage usually ignores boundary
					},
					body: fileData,
				},
				(err, res, body) => {
					if (err) {
						return reject({
							success: false,
							error: err.message || err,
						})
					}
					resolve({
						statusCode: res.statusCode,
						success: true,
					})
				}
			)
		} catch (error) {
			return reject({
				success: false,
				error: error.message || error,
			})
		}
	})
}

module.exports = {
	get: get,
	post: post,
	put: put,
}

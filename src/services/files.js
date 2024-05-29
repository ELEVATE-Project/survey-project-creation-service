/**
 * Name: Ankit Shahu
 * Date: 28-May-2024
 * Description: file.js service
 */

// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const { cloudClient } = require('@configs/cloud-service')
const endpoints = require('@constants/endpoints')
const cloudStorage = process.env.CLOUD_STORAGE_PROVIDER
const bucketName = process.env.CLOUD_STORAGE_BUCKETNAME

module.exports = class FilesHelper {
	/**
	 * Get Signed Url
	 * @method
	 * @name getSignedUrl
	 * @param {JSON} payloadData  request body.
	 * @param {string} referenceType- what type of document
	 * @param {string} userId  -  userId
	 * @param {boolean} serviceUpload - needed for nic server
	 * @returns {JSON} - Response contains signed url
	 */
	static async getSignedUrl(payloadData, referenceType, userId = '', serviceUpload = false) {
		try {
			let payloadIds = Object.keys(payloadData)

			let result = {
				[payloadIds[0]]: {},
			}

			let folderPath = ''
			// let referenceTypes = [common.CERTIFICATE, common.LOGO, common.SIGNATURE, common.BASETEMPLATE]
			let referenceTypes = {
				[common.CERTIFICATE]: common.CERTIFICATE_PATH,
				[common.LOGO]: common.LOGO_PATH,
				[common.SIGNATURE]: common.SIGNATURE_PATH,
				[common.BASETEMPLATE]: common.BASETEMPLATE_PATH,
			}
			if (referenceTypes.hasOwnProperty(referenceType)) {
				folderPath =
					referenceTypes[referenceType] + userId + '/' + payloadIds[0] + '/' + utils.generateUniqueId() + '/'
			} else {
				folderPath = common.RESOURCE_PATH + userId + '/' + payloadIds[0] + '/' + utils.generateUniqueId() + '/'
			}

			let actionPermission = common.WRITE_ACCESS
			let fileNames = payloadData[payloadIds[0]].files
			if (!Array.isArray(fileNames) || fileNames.length < 1) {
				throw new Error('File names not given.')
			}
			let linkExpireTime = common.NO_OF_EXPIRY_TIME * common.NO_OF_MINUTES

			const signedUrlsPromises = fileNames.map(async (fileName) => {
				let file = folderPath && folderPath !== '' ? folderPath + fileName : fileName
				let response = {
					file: file,
					payload: { sourcePath: file },
					cloudStorage: cloudStorage.toUpperCase(),
				}
				response.downloadableUrl = await cloudClient.getDownloadableUrl(
					bucketName,
					file,
					linkExpireTime // Link ExpireIn
				)
				if (!serviceUpload) {
					response.url = await cloudClient.getSignedUrl(
						bucketName, // bucket name
						file, // file path
						linkExpireTime, // expire
						actionPermission // read/write
					)
				} else {
					response.url = `${process.env.PUBLIC_BASE_URL}/${endpoints.UPLOAD_FILE}?file=${file}`
				}

				return response
			})

			// Wait for all signed URLs promises to resolve
			const signedUrls = await Promise.all(signedUrlsPromises)
			result[payloadIds[0]]['files'] = signedUrls

			return responses.successResponse({
				message: 'SIGNED_URL_GENERATED_SUCCESSFULLY',
				statusCode: httpStatusCode.ok,
				responseCode: 'OK',
				result: result,
			})
		} catch (error) {
			throw error
		}
	}
	/**
	 * Get downloadable Url
	 * @method
	 * @name getDownloadableUrl
	 * @param {JSON} payloadData  request body.
	 * @returns {JSON} - Response contains signed url
	 */
	static async getDownloadableUrl(payloadData) {
		try {
			let linkExpireTime = common.NO_OF_EXPIRY_TIME * common.NO_OF_MINUTES

			if (Array.isArray(payloadData) && payloadData.length > 0) {
				let result = []

				await Promise.all(
					payloadData.map(async (element) => {
						let responseObj = {
							cloudStorage: cloudStorage,
						}
						responseObj.filePath = element
						responseObj.url = await cloudClient.getDownloadableUrl(bucketName, element, linkExpireTime)
						result.push(responseObj)
					})
				)

				return responses.successResponse({
					message: 'DOWNLOAD_URL_GENERATED_SUCCESSFULLY',
					statusCode: httpStatusCode.ok,
					responseCode: 'OK',
					result: result,
				})
			}
		} catch (error) {
			throw error
		}
	}
	/**
	 * Get Json data from URL
	 * @method
	 * @name fetchJsonFromCloud
	 * @param {JSON} filePath  file path.
	 * @returns {JSON} - Response contains json
	 */

	static async fetchJsonFromCloud(filePath) {
		try {
			let result = {}
			let downloadableUrl = await cloudClient.getDownloadableUrl(bucketName, filePath)
			if (downloadableUrl) {
				const data = await fetch(downloadableUrl).then((res) => res.json())
				if (data && Object.keys(data).length > 0) {
					result = data
				}

				return responses.successResponse({
					message: 'DOWNLOAD_URL_GENERATED_SUCCESSFULLY',
					statusCode: httpStatusCode.ok,
					responseCode: 'OK',
					result: result,
				})
			} else {
				return responses.failureResponse({
					message: 'FAILED_TO_DOWNLOAD_FILE',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
		} catch (error) {
			return error
		}
	}
}

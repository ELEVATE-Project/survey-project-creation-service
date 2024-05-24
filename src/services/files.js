/**
 * name : files.js
 * author : Aman Gupta
 * created-date : 03-Nov-2021
 * Description : files helper.
 */

// Dependencies
const cloudServices = require('@generics/cloud-services')
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

			if (referenceType == common.CERTIFICATE) {
				folderPath =
					common.CERTIFICATE_PATH + userId + '/' + payloadIds[0] + '/' + utils.generateUniqueId() + '/'
			} else if (referenceType == common.LOGO) {
				folderPath = common.LOGO_PATH + userId + '/' + payloadIds[0] + '/' + utils.generateUniqueId() + '/'
			} else if (referenceType == common.SIGNATURE) {
				folderPath = common.SIGNATURE_PATH + userId + '/' + payloadIds[0] + '/' + utils.generateUniqueId() + '/'
			} else if (referenceType == common.BASETEMPLATE) {
				folderPath =
					common.BASETEMPLATE_PATH + userId + '/' + payloadIds[0] + '/' + utils.generateUniqueId() + '/'
			} else {
				folderPath = common.PROJECT_PATH + userId + '/' + payloadIds[0] + '/' + utils.generateUniqueId() + '/'
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
}

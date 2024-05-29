/**
 * name : files.js
 * author : Aman Gupta
 * created-date : 03-Nov-2021
 * Description : files helper.
 */

// Dependencies
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const { cloudClient } = require('@configs/cloud-service')
const bucketName = process.env.CLOUD_STORAGE_BUCKETNAME

module.exports = class FilesHelper {
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
					message: 'JSON_FETCHED_SUCCESSFULLY',
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

/**
 * name : cloud-service.js
 * author : Ankit Shahu
 * created-date : 17-May-2024
 * Description : Google cloud services methods.
 */

const filesService = require('@services/files')

module.exports = class File {
	/**
	 * Get Signed Url
	 * @method
	 * @name getSignedUrl
	 * @param {JSON} req  request body.
	 * @param {string} req.query.fileName  name of the file
	 * @param {string} req.decodedToken._id  it contains userId
	 * @returns {JSON} Response with status message and result .
	 */
	async getSignedUrl(req) {
		try {
			const signedUrlResponse = await filesService.getSignedUrl(
				req.body.request,
				req.body.ref,
				req.decodedToken ? req.decodedToken.id : '',
				req.query.serviceUpload == 'true' ? true : false
			)
			return signedUrlResponse
		} catch (error) {
			return error
		}
	}

	/**
	 * Get downlodable Url
	 * @method
	 * @name getDownloadableUrl
	 * @param {JSON} req  request body.
	 * @returns {JSON} Response with status message and result.
	 */
	async getDownloadableUrl(req) {
		try {
			return await filesService.getDownloadableUrl(req.body.filePaths)
		} catch (error) {
			return error
		}
	}

	/**
	 * Get Json from cloud
	 * @method
	 * @name fetchJsonFromCloud
	 * @param {JSON} req  request body.
	 * @returns {JSON} Response with status message and result.
	 */
	async fetchJsonFromCloud(req) {
		try {
			return await filesService.fetchJsonFromCloud(req.body.filePath)
		} catch (error) {
			return error
		}
	}
}

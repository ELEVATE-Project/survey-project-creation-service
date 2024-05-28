/**
 * name : cloud-service.js
 * author : Ankit Shahu
 * created-date : 17-May-2024
 * Description : Google cloud services methods.
 */

const filesService = require('@services/files')

module.exports = class File {
	async fetchJsonFromCloud(req) {
		try {
			return await filesService.fetchJsonFromCloud(req.body.filePath)
		} catch (error) {
			return error
		}
	}
}

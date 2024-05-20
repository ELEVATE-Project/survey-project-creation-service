/**
 * name : config.js
 * author : Adithya Dinesh
 * created-date : 20-May-2024
 * Description : Controller for instance level configs.
 */

const configsService = require('@services/config')
module.exports = class configs {
	/**
	 * List configs based on requester's org
	 * @method
	 * @name list
	 * @returns {JSON} - configs object.
	 */

	async list(req) {
		try {
			const configList = await configsService.list(req.decodedToken.organization_id)

			return configList
		} catch (error) {
			return error
		}
	}
}

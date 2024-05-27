const configsService = require('@services/config')

module.exports = class configs {
	/**
	 * List Configs.
	 * @method
	 * @name list
	 * @returns {JSON} - List of configs as response.
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

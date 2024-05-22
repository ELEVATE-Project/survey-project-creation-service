const configsService = require('@services/config')

module.exports = class configs {
	async list(req) {
		try {
			const configList = await configsService.list(req.decodedToken.organization_id)

			return configList
		} catch (error) {
			return error
		}
	}
}

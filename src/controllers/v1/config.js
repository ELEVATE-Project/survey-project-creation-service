/**
 * name : config.js
 * author : Adithya Dinesh
 * created-date : 20-May-2024
 * Description : Controller for instance level configs.
 */

const orgExtensionService = require('@services/organization-extension')
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
module.exports = class configs {
	/**
	 * List Configs.
	 * @method
	 * @name list
	 * @returns {JSON} - List of configs as response.
	 */
	async list(req) {
		try {
			const configList = await orgExtensionService.getConfig(
				req.decodedToken.organization_code,
				req.decodedToken.tenant_code
			)

			return configList
		} catch (error) {
			return error
		}
	}

	//create config

	/**
	 * List Configs.
	 * @method
	 * @name list
	 * @returns {JSON} - List of configs as response.
	 */
	async create(req) {
		try {
			const configs = await orgExtensionService.createConfig(
				req.body,
				req.decodedToken.organization_code,
				req.decodedToken.tenant_code,
				false
			)

			return configs
		} catch (error) {
			return error
		}
	}
}

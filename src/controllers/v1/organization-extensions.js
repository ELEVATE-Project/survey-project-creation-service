/**
 * name : organization-extensions.js
 * author : Priyanka Pradeep
 * created-date : 18-June-2024
 * Description : Controller for organization details.
 */

const orgExtensionService = require('@services/organization-extension')

module.exports = class orgExtensions {
	/**
	 * create org extension config
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - org extension creation object.
	 */

	async createConfig(req) {
		try {
			const orgExtension = await orgExtensionService.createConfig(req.body, req.decodedToken.organization_id)
			return orgExtension
		} catch (error) {
			return error
		}
	}

	/**
	 * updates org extension config
	 * @method
	 * @name updateConfig
	 * @param {Object} req - request data.
	 * @returns {JSON} - org extension updating response.
	 */

	async updateConfig(req) {
		try {
			const orgExtension = await orgExtensionService.updateConfig(
				req.params.id,
				req.query.resource_type,
				req.body,
				req.decodedToken.organization_id
			)
			return orgExtension
		} catch (error) {
			return error
		}
	}
}

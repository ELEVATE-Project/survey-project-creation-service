/**
 * name : organization-extensions.js
 * author : Priyanka Pradeep
 * created-date : 18-June-2024
 * Description : Controller for organization details.
 */

const orgExtensionService = require('@services/organization-extension')
const common = require('@constants/common')
const utils = require('@generics/utils')

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
			let organization_code = req.decodedToken.organization_code
			if (utils.validateRoleAccess(req.decodedToken.roles, process.env.DEFAULT_ADMIN_ROLE)) {
				organization_code = req.body.organization_code
					? req.body.organization_code
					: req.decodedToken.organization_code
			}
			const orgExtension = await orgExtensionService.createConfig(req.body, organization_code)
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
			let organization_code = req.decodedToken.organization_code
			if (utils.validateRoleAccess(req.decodedToken.roles, process.env.DEFAULT_ADMIN_ROLE)) {
				organization_code = req.body.organization_code
					? req.body.organization_code
					: req.decodedToken.organization_code
			}
			const orgExtension = await orgExtensionService.updateConfig(
				req.params.id,
				req.query.resource_type,
				req.body,
				organization_code
			)
			return orgExtension
		} catch (error) {
			return error
		}
	}
}

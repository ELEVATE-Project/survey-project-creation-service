/**
 * name : organization-extension.js
 * author : Priyanka Pradeep
 * created-date : 18-June-2024
 * Description : Controller for organization details.
 */

const orgExtensionService = require('@services/organization-extension')

module.exports = class orgExtensions {
	/**
	 * create org extension
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - org extension creation object.
	 */

	async create(req) {
		try {
			const orgExtension = await orgExtensionService.create(req.body)
			return orgExtension
		} catch (error) {
			return error
		}
	}

	/**
	 * updates org extension
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - org extension updating response.
	 */

	async update(req) {
		try {
			const orgExtension = await orgExtensionService.update(req.params.id, req.body)
			return orgExtension
		} catch (error) {
			return error
		}
	}
}

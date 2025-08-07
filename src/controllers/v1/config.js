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
			const { tenantCode, orgCode, error } = utils._extractTenantAndOrgCodes(req)
			if (error)
				return responses.failureResponse({
					message: error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})

			const configList = await orgExtensionService.getConfig(orgCode, tenantCode)

			return configList
		} catch (error) {
			return error
		}
	}
}

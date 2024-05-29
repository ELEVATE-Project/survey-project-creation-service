const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const certificateQueries = require('@database/queries/certificateBaseTemplate')
const { getDefaultOrgId } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')
const utils = require('@generics/utils')
const common = require('@constants/common')

module.exports = class configsHelper {
	/**
	 * List Certificate templates.
	 * @method
	 * @name list
	 * @returns {JSON} - List of certificate templates based on orgId of user as response.
	 */
	static async list(resource_type = '', orgId, search) {
		try {
			let result = {
				data: [],
				count: 0,
			}

			const defaultOrgId = await getDefaultOrgId()

			let filter = {
				organization_id: {
					[Op.in]: [orgId, defaultOrgId],
				},
			}

			if (resource_type) {
				filter.resource_type = resource_type
			}

			const certificate = await certificateQueries.findAll(filter)
			const prunedCertificates = utils.removeDefaultOrgCertificates(certificate, orgId)

			if (prunedCertificates.length > 0) {
			}
			result.data = prunedCertificates
			result.count = prunedCertificates.length

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CERTIFICATE_FETCHED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			console.log(error, 'error')
			// return error message
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'CERTIFICATE_FETCH_FAILED',
				result: [],
			})
		}
	}
}

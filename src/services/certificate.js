const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const certificateQueries = require('@database/queries/certificateBaseTemplate')
const { getDefaultOrgId } = require('@helpers/getDefaultOrgId')
const { Op } = require('sequelize')
const utils = require('@generics/utils')
const filesService = require('@services/files')
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

			//get the downloadable url of certificates
			if (prunedCertificates.length > 0) {
				let sourcePaths = _.map(prunedCertificates, common.URL)
				let certificatesUrl = await filesService.getDownloadableUrl({
					filePaths: sourcePaths,
				})

				if (
					certificatesUrl.statusCode === httpStatusCode.ok &&
					certificatesUrl.result &&
					certificatesUrl.result.length > 0
				) {
					// Create a map of filePath to URL
					let urlMap = _.keyBy(certificatesUrl.result, common.FILE_PATH)

					// Replace the URL in prunedCertificates
					prunedCertificates.forEach((certificate) => {
						if (urlMap[certificate[common.URL]]) {
							certificate[common.URL] = urlMap[certificate[common.URL]].url
						}
					})
				}
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

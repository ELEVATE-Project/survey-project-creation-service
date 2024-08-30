const _ = require('lodash')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const certificateQueries = require('@database/queries/certificateBaseTemplate')
const { UniqueConstraintError } = require('sequelize')
const defaultOrgId = process.env.DEFAULT_ORG_ID
const { Op } = require('sequelize')
const utils = require('@generics/utils')
const filesService = require('@services/files')
const common = require('@constants/common')
module.exports = class certificatesHelper {
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

			let filter = {
				organization_id: {
					[Op.in]: [orgId, defaultOrgId],
				},
			}

			if (resource_type) {
				filter.resource_type = resource_type
			}

			if (search) {
				filter.name = { [Op.iLike]: `%${search}%` }
			}

			const certificate = await certificateQueries.findAll(filter)
			const prunedCertificates = utils.removeDefaultOrgCertificates(certificate, orgId)

			//get the downloadable url of certificates
			if (prunedCertificates.length > 0) {
				let sourcePaths = _.map(prunedCertificates, (item) => item.url)
				let certificatesUrl = await filesService.getDownloadableUrl(sourcePaths)

				if (
					certificatesUrl &&
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
			// return error message
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'CERTIFICATE_FETCH_FAILED',
				result: [],
			})
		}
	}

	/**
	 * Create or Update Certificate templates.
	 * @method
	 * @name update
	 * @returns {JSON} - certificate templates JSON.
	 */
	static async update(id, bodyData, loggedInUserId, orgId) {
		try {
			bodyData.updated_by = loggedInUserId

			if (id) {
				const [updateCount, updatedTemplate] = await certificateQueries.updateOne({ id: id }, bodyData, {
					returning: true,
					raw: true,
				})

				if (updateCount === 0) {
					return responses.failureResponse({
						message: 'CERTIFICATE_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				return responses.successResponse({
					statusCode: httpStatusCode.accepted,
					message: 'CERTIFICATE_UPDATED_SUCCESSFULLY',
					result: updatedTemplate[0],
				})
			} else {
				bodyData.created_by = loggedInUserId
				bodyData.organization_id = orgId
				const certificate = await certificateQueries.create(bodyData)
				return responses.successResponse({
					statusCode: httpStatusCode.created,
					message: 'CERTIFICATE_TEMPLATE_CREATED',
					result: certificate,
				})
			}
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'CERTIFICATE_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
		}
	}
}

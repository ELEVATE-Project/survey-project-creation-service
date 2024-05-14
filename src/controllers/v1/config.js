const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const configsService = require('@services/config')
const responses = require('@helpers/responses')

module.exports = class configs {
	async list(req) {
		try {
			const configList = await configsService.list(req.decodedToken.organization_id)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CONFIGS_FETCHED_SUCCESSFULLY',
				result: configList,
			})
		} catch (error) {
			return error
		}
	}
}

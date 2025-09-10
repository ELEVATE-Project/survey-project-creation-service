const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const { getConfig } = require('@services/organization-extension')
const utils = require('@generics/utils')
module.exports = class targetingCriteriaHelper {
	/**
	 * Add activity of user
	 * @method
	 * @name addUserAction
	 * @param {String} action - action
	 * @param {String} userId - User ID
	 * @param {String} objectId - Ex: Resource ID
	 * @param {String} objectType - Ex: Resource
	 * @param {String} orgId - User Organization ID
	 * @returns {JSON} - activity create response
	 */
	static async validateTargetingCriteria(targeting, orgCode, tenantCode) {
		try {
			targeting = [
				{
					state: '6687b8d38ead9320cf997c65',
					entityType: 'district',
					district: '671097d667b6747799a761a4',
					block: '6710d01167b6747799a7671d',
					professional_role: 'teacher',
					professional_subroles: [
						{
							_id: '66b9df998d2c4516ea1b4494',
							label: 'Block Education Officer',
							value: 'deo',
						},
					],
				},
			]

			const orgConfig = await getConfig(orgCode, tenantCode)
			const targerting_factors = orgConfig?.result?.config?.targeting_criteria?.factors || {}
			for (let eachTargeting of Object.keys(targeting)) {
				for (let eachEntity of Object.keys(targeting[eachTargeting])) {
					const findFactor = targerting_factors.find((factor) => factor.key === eachEntity)
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ACTIVITY_CREATED',
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

function validateFactors(entity, factor) {
	// mandatory factor checks
	if (factor.mandatory) {
		if (factor.multi_select && (!Array.isArray(entity) || entity.length === 0)) return false
		if (!factor.multi_select && !entity) return false
	}

	// check if the entity is multi-select and if the provided entity is an array
	if (factor.multi_select && !Array.isArray(entity)) return false

	if (!factor.multi_select && typeof entity != 'string') return false

	if (Object.keys(factor.api).length > 0) {
		const serviceUrl = process.env[`${factor.api.service.replace(/-/g, '_').toUpperCase()}_HOST`]
		const baseUrl = utils.buildUrl(serviceUrl, factor.api.base_name.tolowerCase())
		const queryParams = factor?.api?.query_params || {}
	}

	return true
}

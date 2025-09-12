const { getConfig } = require('@services/organization-extension')
const defaultOrgCode = process.env.DEFAULT_ORGANIZATION_CODE
const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const common = require('@constants/common')
const utils = require('@generics/utils')
module.exports = class targetingCriteria {
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
		let result = { success: false, errors: [] }
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
			let validationErrors = []
			for (let eachTargeting of Object.keys(targeting)) {
				for (let eachEntity of Object.keys(targeting[eachTargeting])) {
					const findFactor = targerting_factors.find((factor) => factor.key.trim() == eachEntity.trim())
					if (Object.keys(findFactor).length > 0) {
						validationErrors = [
							...validationErrors,
							...validateFactors(targeting[eachTargeting][eachEntity], findFactor),
						]
					}
				}
			}

			if (validationErrors.length > 0) {
				result['errors'] = validationErrors
				return result
			}

			const entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.MODEL_NAMES['TARGETING'],
					status: common.STATUS_ACTIVE,
				},
				orgCode,
				tenantCode,
				['id', 'value', 'label', 'config']
			)
			const filteredEntityTypes = utils.removeDefaultOrgEntityTypes(entityTypes, orgCode, defaultOrgCode)
			// const externalEntityMap

			let externalEntityMap = {}

			for (const entity of filteredEntityTypes) {
				if (entity.is_external) {
					const { service, endPointService, pathParam, queryParam } = entity.api
					const { value } = entity
					// Initialize service object if it doesn't exist
					externalEntityMap[service] = externalEntityMap[service] || {}
					// Initialize endPointService array if it doesn't exist
					externalEntityMap[service][endPointService] = externalEntityMap[service][endPointService] || []
					// Push entity details to the endPointService array
					externalEntityMap[service][endPointService].push({ value, pathParam, queryParam })
				}
			}
			if (Object.keys(externalEntityMap).length > 0) {
				for (const service of Object.keys(externalEntityMap)) {
					const serviceUrl = process.env[`${service.replace(/-/g, '_').toUpperCase()}_SERVICE_HOST`]
				}
			}

			return result
		} catch (error) {
			return result
		}
	}
}

function validateFactors(entity, factor) {
	let validationErrors = []
	let targetingPath = `${common.TARGETING_CRITERIA}`

	// mandatory factor checks
	if (factor.mandatory) {
		if (factor.multi_select && (!Array.isArray(entity) || entity.length === 0)) {
			validationErrors.push(
				utils.errorObject(
					targetingPath,
					factor.key,
					`${factor.key} must be an array with at least one selection`
				)
			)
		}
		if (!factor.multi_select && !entity) {
			validationErrors.push(utils.errorObject(targetingPath, factor.key, `${factor.key} must not be empty`))
		}
	}

	// check if the entity is multi-select and if the provided entity is an array
	if (factor.multi_select && !Array.isArray(entity)) {
		validationErrors.push(utils.errorObject(targetingPath, factor.key, `${factor.key} must be an array`))
	}

	if (!factor.multi_select && typeof entity != 'string') {
		validationErrors.push(utils.errorObject(targetingPath, factor.key, `${factor.key} must be a string`))
	}

	// if (Object.keys(factor.api).length > 0) {
	// 	const serviceUrl = process.env[`${factor.api.service.replace(/-/g, '_').toUpperCase()}_HOST`]
	// 	const baseUrl = utils.buildUrl(serviceUrl, factor.api.base_name.tolowerCase())
	// 	const queryParams = factor?.api?.query_params || {}
	// }

	return validationErrors
}

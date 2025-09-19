const { getConfig } = require('@services/organization-extension')
const defaultOrgCode = process.env.DEFAULT_ORGANIZATION_CODE
const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const common = require('@constants/common')
const utils = require('@generics/utils')
const targetingPath = (index = '') => {
	return `${common.TARGETING}${index !== '' ? `[${index}]` : ''}`
}

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
		let validationErrors = []
		try {
			if (!targeting && !Array.isArray(targeting) && targeting.length <= 0) {
				validationErrors.push(
					utils.errorObject(
						targetingPath(),
						targetingPath(),
						`${targetingPath} must be an array with at least one selection`
					)
				)
			}
			// grouping elements per entity type
			let elementsPerEntityType = {}

			for (let ele of targeting) {
				Object.keys(ele).forEach((key) => {
					if (!elementsPerEntityType[key]) {
						elementsPerEntityType[key] = []
					}
					elementsPerEntityType[key].push(ele[key])
				})
			}

			const orgConfig = await getConfig(orgCode, tenantCode)
			const targerting_factors = orgConfig?.result?.config?.targeting_criteria?.factors || {}
			let index = 0
			for (let eachTargeting of Object.keys(targeting)) {
				for (let eachEntity of Object.keys(targeting[eachTargeting])) {
					const findFactor = targerting_factors.find((factor) => factor.key.trim() == eachEntity.trim())
					if (findFactor && Object.keys(findFactor).length > 0) {
						validationErrors = [
							...validationErrors,
							...validateFactors(targeting[eachTargeting][eachEntity], findFactor, index),
						]
					}
				}
				index++
			}

			if (validationErrors.length > 0) {
				result['errors'] = validationErrors
				throw new Error('Validation errors in targeting criteria')
			}
			// external validation to be added here
			// const entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
			// 	{
			// 		model: common.MODEL_NAMES['TARGETING'],
			// 		status: common.STATUS_ACTIVE,
			// 	},
			// 	orgCode,
			// 	tenantCode,
			// 	['id', 'value', 'label', 'config']
			// )
			// const filteredEntityTypes = utils.removeDefaultOrgEntityTypes(entityTypes, orgCode, defaultOrgCode)
			// const externalEntityMap

			// let externalEntityMap = {}

			// for (const entity of filteredEntityTypes) {
			// 	if (entity.is_external) {
			// 		const { service, endPointService, pathParam, queryParam } = entity.api
			// 		const { value } = entity
			// 		// Initialize service object if it doesn't exist
			// 		externalEntityMap[service] = externalEntityMap[service] || {}
			// 		// Initialize endPointService array if it doesn't exist
			// 		externalEntityMap[service][endPointService] = externalEntityMap[service][endPointService] || []
			// 		// Push entity details to the endPointService array
			// 		externalEntityMap[service][endPointService].push({ value, pathParam, queryParam })
			// 	}
			// }

			// if (Object.keys(externalEntityMap).length > 0) {
			// 	for (const service of Object.keys(externalEntityMap)) {
			// 		const serviceUrl = process.env[`${service.replace(/-/g, '_').toUpperCase()}_SERVICE_HOST`]
			// 		const serviceName = process.env[`${service.replace(/-/g, '_').toUpperCase()}_SERVICE_NAME`]
			// 		const baseUrl = utils.buildUrl(serviceUrl, serviceName.toLowerCase())
			// 		const endPoint = utils.buildUrl(baseUrl, externalEntityMap[service])

			// 		const finalEndPoint = utils.buildUrl(baseUrl, endPoint , )

			// 	}
			// }
			result['success'] = true
			return result
		} catch (error) {
			result['success'] = false
			result['errors'] = validationErrors
			return result
		}
	}

	static async scopeKeys(orgCode, tenantCode) {
		const orgConfig = await getConfig(orgCode, tenantCode)
		const targerting_factors = orgConfig?.result?.config?.targeting_criteria?.factors || {}
		const scopeKeys = targerting_factors.reduce((acc, index) => {
			acc[index.key] = {
				multi_select: index.multi_select,
				mandatory: index.mandatory,
			}
			return acc
		}, {})
		return scopeKeys
	}
}

function validateFactors(entity, factor, index) {
	let validationErrors = []

	// mandatory factor checks
	if (factor.mandatory) {
		if (factor.multi_select && (!Array.isArray(entity) || entity.length === 0)) {
			validationErrors.push(
				utils.errorObject(
					targetingPath(index),
					factor.key,
					`${factor.key} must be an array with at least one selection`
				)
			)
		}
		if (!factor.multi_select && !entity) {
			validationErrors.push(
				utils.errorObject(targetingPath(index), factor.key, `${factor.key} must not be empty`)
			)
		}
	}

	// check if the entity is multi-select and if the provided entity is an array
	if (factor.multi_select && !Array.isArray(entity)) {
		validationErrors.push(utils.errorObject(targetingPath(index), factor.key, `${factor.key} must be an array`))
	}

	if (!factor.multi_select && typeof entity != 'string') {
		validationErrors.push(utils.errorObject(targetingPath(index), factor.key, `${factor.key} must be a string`))
	}

	// if (Object.keys(factor.api).length > 0) {
	// 	const serviceUrl = process.env[`${factor.api.service.replace(/-/g, '_').toUpperCase()}_HOST`]
	// 	const baseUrl = utils.buildUrl(serviceUrl, factor.api.base_name.tolowerCase())
	// 	const queryParams = factor?.api?.query_params || {}
	// }

	return validationErrors
}

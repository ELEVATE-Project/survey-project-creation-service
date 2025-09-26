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

	return validationErrors
}

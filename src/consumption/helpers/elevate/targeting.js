/**
 * name : targeting.js
 * author : Priyanka Pradeep
 * Date : 18-NOV-2025
 * Description : Helper for targeting data transformation
 */

'use strict'

const common = require('@constants/common')

/**
 * Process targeting criteria for programs
 * @method
 * @name processTargetingCriteria
 * @param {Object} targetingData - Program targeting criteria data
 * @param {String} organizationCode - Organization code
 * @param {String} tenantCode - Tenant code
 * @param {Object} scopeKeys - Scope keys configuration
 * @returns {Object} Response with scope and metaInformation or error
 */
exports.processTargetingCriteria = async (targetingData, organizationCode, tenantCode, scopeKeys = {}) => {
	try {
		let scope = {}
		let keysToRemoveFromScope = []

		// Configuration for mapping keys to data paths
		const scopeKeyToDataPath = {
			roles: 'professional_role',
			sub_roles: 'professional_subroles',
		}

		targetingData = targetingData.map((criteria) => {
			for (let criteriaKey of Object.keys(criteria)) {
				let isKeyModified = false
				// find data path if the key is modified
				const dataPath = scopeKeyToDataPath?.[criteriaKey] || null
				// if key is modified (i.e dataPath is not null ) and the scope is expecting multi select
				if (dataPath && scopeKeys?.[dataPath]?.multi_select) {
					// if key is modified and the actual data path has values
					if (criteria?.[dataPath]?.length > 0 && criteria?.[criteriaKey]?.length > 0) {
						criteria[dataPath] = [...criteria[dataPath], ...criteria[criteriaKey]]
						isKeyModified = true
						// if key is modified and the actual data path has no values or the key is not present in targeting
					} else if (!criteria?.[dataPath] && criteria?.[criteriaKey].length > 0) {
						criteria[dataPath] = [...criteria[criteriaKey]]
						isKeyModified = true
					}
				} else if (dataPath && !scopeKeys?.[dataPath]?.multi_select) {
					criteria[dataPath] = criteria[criteriaKey]
					isKeyModified = true
				}
				if (dataPath && isKeyModified) keysToRemoveFromScope.push(criteriaKey)
				if (
					scopeKeys &&
					!Object.keys(scopeKeys).includes(criteriaKey) &&
					!keysToRemoveFromScope.includes(criteriaKey)
				)
					keysToRemoveFromScope.push(criteriaKey)
			}
			return criteria
		})

		// add organization into the scope by default
		scope[`${common.SCOPE_ELEMENT_ORGANIZATIONS}`] = [organizationCode]
		let mandatoryKeys = []
		// iterate through the scope keys and create empty array for each key
		// also track the mandatory keys
		for (let scopeElement of Object.keys(scopeKeys)) {
			scope[scopeElement] = []
			if (scopeKeys[scopeElement]?.mandatory) {
				mandatoryKeys.push(scopeElement)
			}
		}

		let metaInformation = {}
		const metaInformationKeys = [...new Set(process.env.PROGRAM_META_INFO_KEYS.split(',').map((key) => key))]

		if (targetingData && Object.keys(targetingData).length > 0 && scope && Object.keys(scope).length > 0) {
			// Iterate through each targeting criterion
			for (let i = 0; i < targetingData.length; i++) {
				const targeting = targetingData[i]
				let skipTargeting = false // flag to skip further processing if 'ALL' is found
				for (let eachTargeting of Object.keys(targeting)) {
					const target = targeting?.[eachTargeting] || null
					if (!Object.keys(scope).includes(eachTargeting)) scope[eachTargeting] = []
					// check if the current scope already has 'ALL' keyword and set the flag
					if (
						scope[eachTargeting] == common.TARGETING_ALL ||
						scope[eachTargeting].includes(common.TARGETING_ALL)
					) {
						skipTargeting = true
					}
					// if the particular targeting has 'ALL' keyword, ignore the processing
					if (!skipTargeting) {
						if (target && typeof target == common.STRING) {
							// if the target is string , possibly we are expecting the _id of the entity.
							// Hence push it directly making sure the value is unique
							if (!scope[eachTargeting].includes(target)) {
								if (scope[eachTargeting] == common.TARGETING_ALL) {
									scope[eachTargeting] = [common.TARGETING_ALL] // if targeting is all , set the array as ["ALL"]
								} else {
									scope[eachTargeting].push(target)
								}
							}
						} else if (target && Array.isArray(target) && target.length > 0) {
							// if any of the element is ALL , record only ALL
							if (target.includes(common.TARGETING_ALL)) {
								scope[eachTargeting] = [common.TARGETING_ALL] // if targeting is all , set the array as ["ALL"]
							} else {
								// if the target is an array , iterate through each element
								target.forEach((targetEntity) => {
									// if the element inside array is string , possibly we are expecting the _id of the entity.
									// Hence push it directly making sure the value is unique
									if (typeof targetEntity == common.STRING)
										if (!scope[eachTargeting].includes(targetEntity))
											scope[eachTargeting].push(targetEntity)
									if (typeof targetEntity == common.OBJECT) {
										// if the element inside array is an object.
										// check for _id or id within the object
										const id = targetEntity?._id || targetEntity?.id || null
										if (id && !scope[eachTargeting].includes(id)) scope[eachTargeting].push(id)
									}
								})
							}
						} else if (target && typeof target == common.OBJECT && Object.keys(target).length > 0) {
							// if the target is an object.
							// check for _id or id within the object.
							const id = target?._id || target?.id || null
							if (id && !scope[eachTargeting].includes(target)) scope[eachTargeting].push(id)
						}
					}
				}
			}

			// Configuration for mapping keys to data paths
			const keyToDataPath = {
				state: 'state',
				recommendedFor: 'roles',
			}

			metaInformation = createMetaInfo(targetingData, metaInformationKeys, keyToDataPath)
		}

		if (mandatoryKeys.length > 0) {
			for (const key of mandatoryKeys) {
				if (!scope[key] || scope[key].length == 0) {
					scope[key] = [common.TARGETING_ALL]
				}
			}
		}

		if (scope) {
			scope = Object.fromEntries(
				Object.entries(scope).filter(([key, value]) =>
					Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined
				)
			)
		}

		if (keysToRemoveFromScope.length > 0) {
			for (const key of keysToRemoveFromScope) {
				scope[key] && delete scope[key]
			}
		}

		return { scope, metaInformation, success: true }
	} catch (error) {
		console.log('Error in creating targeting : ', error)
		return {
			success: false,
			error,
		}
	}
}

/**
 * Helper function to create meta information from targeting criteria
 * @method
 * @name createMetaInfo
 * @param {Array} targetingCriteria - Array of targeting criteria
 * @param {Array} metaInformationKeys - Keys for meta information
 * @param {Object} keyToDataPath - Mapping of keys to data paths
 * @returns {Object} Meta information object
 */
function createMetaInfo(targetingCriteria, metaInformationKeys, keyToDataPath) {
	const metaInfo = {}
	metaInformationKeys.forEach((key) => {
		metaInfo[key] = new Set()
	})

	targetingCriteria.forEach((criteria) => {
		metaInformationKeys.forEach((key) => {
			const dataPath = keyToDataPath[key]
			if (dataPath) {
				const items = criteria[dataPath] || []
				items.forEach((item) => {
					if (item.name) {
						metaInfo[key].add(item.name)
					}
				})
			}
		})
	})

	metaInformationKeys.forEach((key) => {
		metaInfo[key] = Array.from(metaInfo[key])
	})

	return metaInfo
}

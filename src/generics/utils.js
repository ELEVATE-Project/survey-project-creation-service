/**
 * name : utils.js
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : Utils helper function.
 */

const bcryptJs = require('bcryptjs')
const momentTimeZone = require('moment-timezone')
const moment = require('moment')
const path = require('path')
// const md5 = require('md5')
const { RedisCache, InternalCache } = require('elevate-node-cache')
const startCase = require('lodash/startCase')
const common = require('@constants/common')
const crypto = require('crypto')
const { cloudClient } = require('@configs/cloud-service')
const { v4: uuidV4 } = require('uuid')
const unidecode = require('unidecode')
const _ = require('lodash')

const composeEmailBody = (body, params) => {
	return body.replace(/{([^{}]*)}/g, (a, b) => {
		var r = params[b]
		return typeof r === 'string' || typeof r === 'number' ? r : a
	})
}

const extractEmailTemplate = (input, conditions) => {
	const allConditionsRegex = /{{(.*?)}}(.*?){{\/\1}}/g
	let result = input

	for (const match of input.matchAll(allConditionsRegex)) {
		result = conditions.includes(match[1]) ? result.replace(match[0], match[2]) : result.replace(match[0], '')
	}

	return result
}

function internalSet(key, value) {
	return InternalCache.setKey(key, value)
}
function internalGet(key) {
	return InternalCache.getKey(key)
}
function internalDel(key) {
	return InternalCache.delKey(key)
}

function redisSet(key, value, exp) {
	return RedisCache.setKey(key, value, exp)
}
function redisGet(key) {
	return RedisCache.getKey(key)
}
function redisDel(key) {
	return RedisCache.deleteKey(key)
}
const capitalize = (str) => {
	return startCase(str)
}
function isNumeric(value) {
	return /^\d+$/.test(value)
}

function validateInput(input, validationData, modelName) {
	const errors = []
	for (const field of validationData) {
		const fieldValue = input[field.value]

		if (modelName && !field.model_names.includes(modelName) && input[field.value]) {
			errors.push({
				param: field.value,
				msg: `${field.value} is not allowed for the ${modelName} model.`,
			})
		}

		function addError(field, value, dataType, message) {
			errors.push({
				param: field.value,
				msg: `${value} is invalid for data type ${dataType}. ${message}`,
			})
		}

		if (fieldValue !== undefined) {
			const dataType = field.data_type

			switch (dataType) {
				case 'ARRAY[STRING]':
					if (Array.isArray(fieldValue)) {
						fieldValue.forEach((element) => {
							if (typeof element !== 'string') {
								addError(field, element, dataType, 'It should be a string')
							} else if (field.allow_custom_entities && /[^A-Za-z0-9\s_]/.test(element)) {
								addError(
									field,
									element,
									dataType,
									'It should not contain special characters except underscore.'
								)
							}
						})
					} else {
						addError(field, field.value, dataType, '')
					}
					break

				case 'STRING':
					if (typeof fieldValue !== 'string') {
						addError(field, fieldValue, dataType, 'It should be a string')
					} else if (field.allow_custom_entities && /[^A-Za-z0-9\s_]/.test(fieldValue)) {
						addError(
							field,
							fieldValue,
							dataType,
							'It should not contain special characters except underscore.'
						)
					}
					break

				case 'NUMBER':
					console.log('Type of', typeof fieldValue)
					if (typeof fieldValue !== 'number') {
						addError(field, fieldValue, dataType, '')
					}
					break

				default:
					//isValid = false
					break
			}
		}

		if (!fieldValue || field.allow_custom_entities === true || field.has_entities === false) {
			continue // Skip validation if the field is not present in the input or allow_custom_entities is true
		}

		if (Array.isArray(fieldValue)) {
			for (const value of fieldValue) {
				if (!field.entities.some((entity) => entity.value === value)) {
					errors.push({
						param: field.value,
						msg: `${value} is not a valid entity.`,
					})
				}
			}
		} else if (!field.entities.some((entity) => entity.value === fieldValue)) {
			errors.push({
				param: field.value,
				msg: `${fieldValue} is not a valid entity.`,
			})
		}
	}

	if (errors.length === 0) {
		return {
			success: true,
			message: 'Validation successful',
		}
	}

	return {
		success: false,
		errors: errors,
	}
}

const entityTypeMapGenerator = (entityTypeData) => {
	try {
		const entityTypeMap = new Map()
		entityTypeData.forEach((entityType) => {
			const labelsMap = new Map()
			const entities = entityType.entities.map((entity) => {
				labelsMap.set(entity.value, entity.label)
				return entity.value
			})
			if (!entityTypeMap.has(entityType.value)) {
				const entityMap = new Map()
				entityMap.set('allow_custom_entities', entityType.allow_custom_entities)
				entityMap.set('entities', new Set(entities))
				entityMap.set('labels', labelsMap)
				entityTypeMap.set(entityType.value, entityMap)
			}
		})
		return entityTypeMap
	} catch (err) {
		console.log(err)
	}
}

function restructureBody(requestBody, entityData, allowedKeys) {
	try {
		const entityTypeMap = entityTypeMapGenerator(entityData)
		const doesAffectedFieldsExist = Object.keys(requestBody).some((element) => entityTypeMap.has(element))
		// if request body doesn't have field to restructure break the operation return requestBody
		if (!doesAffectedFieldsExist) return requestBody
		// add object custom_entity_text to request body
		requestBody.custom_entity_text = {}
		// If request body does not contain meta add meta object
		if (!requestBody.meta) requestBody.meta = {}
		// Iterate through each key in request body
		for (const currentFieldName in requestBody) {
			// store correct key's value
			const [currentFieldValue, isFieldValueAnArray] = Array.isArray(requestBody[currentFieldName])
				? [[...requestBody[currentFieldName]], true] //If the requestBody[currentFieldName] is array, make a copy in currentFieldValue than a reference
				: [requestBody[currentFieldName], false]
			// Get entity type mapped to current data
			const entityType = entityTypeMap.get(currentFieldName)
			// Check if the current data have any entity type associated with and if allow_custom_entities= true enter to if case
			if (entityType && entityType.get('allow_custom_entities')) {
				// If current field value is of type Array enter to this if condition
				if (isFieldValueAnArray) {
					requestBody[currentFieldName] = [] //Set the original field value as empty array so that it can be re-populated again
					const recognizedEntities = []
					const customEntities = []
					// Iterate though correct fields value of type Array
					for (const value of currentFieldValue) {
						// If entity has entities which matches value push the data into recognizedEntities array
						// Else push to customEntities as { value: 'other', label: value }
						if (entityType.get('entities').has(value)) recognizedEntities.push(value)
						else customEntities.push({ value: 'other', label: value })
					}
					// If we have data in recognizedEntities
					if (recognizedEntities.length > 0)
						if (allowedKeys.includes(currentFieldName))
							// If the current field have a concrete column in db assign recognizedEntities to requestBody[currentFieldName]
							// Else add that into meta
							requestBody[currentFieldName] = recognizedEntities
						else requestBody.meta[currentFieldName] = recognizedEntities
					if (customEntities.length > 0) {
						requestBody[currentFieldName].push('other') //This should cause error at DB write
						requestBody.custom_entity_text[currentFieldName] = customEntities
					}
				} else {
					if (!entityType.get('entities').has(currentFieldValue)) {
						requestBody.custom_entity_text[currentFieldName] = {
							value: 'other',
							label: currentFieldValue,
						}
						if (allowedKeys.includes(currentFieldName))
							requestBody[currentFieldName] = 'other' //This should cause error at DB write
						else requestBody.meta[currentFieldName] = 'other'
					} else if (!allowedKeys.includes(currentFieldName))
						requestBody.meta[currentFieldName] = currentFieldValue
				}
			}

			if (entityType && !entityType.get('allow_custom_entities') && !entityType.get('has_entities')) {
				// check allow = false has entiy false
				if (!allowedKeys.includes(currentFieldName))
					requestBody.meta[currentFieldName] = requestBody[currentFieldName]
			}
		}
		if (Object.keys(requestBody.meta).length === 0) requestBody.meta = null
		if (Object.keys(requestBody.custom_entity_text).length === 0) requestBody.custom_entity_text = null
		return requestBody
	} catch (error) {
		console.error(error)
	}
}

function processDbResponse(responseBody, entityType) {
	// Check if the response body has a "meta" property
	if (responseBody.meta) {
		entityType.forEach((entity) => {
			const entityTypeValue = entity.value
			if (responseBody?.meta?.hasOwnProperty(entityTypeValue)) {
				// Move the key from responseBody.meta to responseBody root level
				responseBody[entityTypeValue] = responseBody.meta[entityTypeValue]
				// Delete the key from responseBody.meta
				delete responseBody.meta[entityTypeValue]
			}
		})
	}

	const output = { ...responseBody } // Create a copy of the responseBody object
	// Iterate through each key in the output object
	for (const key in output) {
		// Check if the key corresponds to an entity type and is not null
		if (entityType.some((entity) => entity.value === key) && output[key] !== null) {
			// Find the matching entity type for the current key
			const matchingEntity = entityType.find((entity) => entity.value === key)
			// Filter and map the matching entity values
			const matchingValues = matchingEntity.entities
				.filter((entity) => (Array.isArray(output[key]) ? output[key].includes(entity.value) : true))
				.map((entity) => ({
					value: entity.value,
					label: entity.label,
				}))
			// Check if there are matching values
			if (matchingValues.length > 0)
				output[key] = Array.isArray(output[key])
					? matchingValues
					: matchingValues.find((entity) => entity.value === output[key])
			else if (Array.isArray(output[key])) output[key] = output[key].filter((item) => item.value && item.label)
		}

		if (output.meta && output.meta[key] && entityType.some((entity) => entity.value === output.meta[key].value)) {
			const matchingEntity = entityType.find((entity) => entity.value === output.meta[key].value)
			output.meta[key] = {
				value: matchingEntity.value,
				label: matchingEntity.label,
			}
		}
	}

	const data = output

	// Merge "custom_entity_text" into the respective arrays
	for (const key in data.custom_entity_text) {
		if (Array.isArray(data[key])) data[key] = [...data[key], ...data.custom_entity_text[key]]
		else data[key] = data.custom_entity_text[key]
	}
	delete data.custom_entity_text

	// Check if the response body has a "meta" property
	if (data.meta && Object.keys(data.meta).length > 0) {
		// Merge properties of data.meta into the top level of data
		Object.assign(data, data.meta)
		// Remove the "meta" property from the output
		delete output.meta
	}

	return data
}

function processQueryParametersWithExclusions(query) {
	const queryArrays = {}
	const excludedKeys = common.excludedQueryParams
	for (const queryParam in query) {
		if (query.hasOwnProperty(queryParam) && !excludedKeys.includes(queryParam)) {
			queryArrays[queryParam] = query[queryParam].split(',').map((item) => item.trim())
		}
	}

	return queryArrays
}

function deleteProperties(obj, propertiesToDelete) {
	try {
		return Object.keys(obj).reduce((result, key) => {
			if (!propertiesToDelete.includes(key)) {
				result[key] = obj[key]
			}
			return result
		}, {})
	} catch (error) {
		return obj
	}
}

const generateWhereClause = (tableName) => {
	let whereClause = ''

	switch (tableName) {
		case 'sessions':
			const currentEpochDate = Math.floor(new Date().getTime() / 1000) // Get current date in epoch format
			whereClause = `deleted_at IS NULL AND start_date >= ${currentEpochDate}`
			break
		case 'mentor_extensions':
			whereClause = `deleted_at IS NULL`
			break
		case 'user_extensions':
			whereClause = `deleted_at IS NULL`
			break
		default:
			whereClause = 'deleted_at IS NULL'
	}

	return whereClause
}

function validateFilters(input, validationData, modelName) {
	const entityTypes = []
	validationData.forEach((entityType) => {
		// Extract the 'value' property from the main object
		entityTypes.push(entityType.value)

		// Extract the 'value' property from the 'entities' array
	})

	for (const key in input) {
		if (input.hasOwnProperty(key)) {
			if (entityTypes.includes(key)) {
				continue
			} else {
				delete input[key]
			}
		}
	}
	return input
}

const removeDefaultOrgEntityTypes = (entityTypes, orgId) => {
	const entityTypeMap = new Map()
	entityTypes.forEach((entityType) => {
		if (!entityTypeMap.has(entityType.value)) entityTypeMap.set(entityType.value, entityType)
		else if (entityType.organization_id === orgId) entityTypeMap.set(entityType.value, entityType)
	})
	return Array.from(entityTypeMap.values())
}

const generateUniqueId = () => {
	return uuidV4()
}

const removeDefaultOrgCertificates = (certificates, orgId) => {
	const certificateMap = new Map()
	certificates.forEach((cert) => {
		if (!certificateMap.has(cert.code)) certificateMap.set(cert.code, cert)
		else if (cert.organization_id === orgId) certificateMap.set(cert.code, cert)
	})
	return Array.from(certificateMap.values())
}

const errorObject = (params, filed, msg, key = '') => {
	return [{ location: params, param: filed, msg }]
}

const checkRegexPattern = (entityType, entityData) => {
	try {
		let normalizedValue =
			typeof entityData === common.DATA_TYPE_NUMBER ? entityData.toString() : unidecode(entityData)
		if (Array.isArray(entityType.validations.regex)) {
			for (let pattern of entityType.validations.regex) {
				let regex = new RegExp(pattern)
				if (regex.test(normalizedValue)) {
					return true
				}
			}
			return false
		} else {
			// Handle the case where the regex validation is not an array
			let regex = new RegExp(entityType.validations.regex)
			return regex.test(normalizedValue)
		}
	} catch (error) {
		return error
	}
}

const checkRequired = (entityType, entityData) => {
	try {
		if (entityType.type === common.REQUIRED_VALIDATION && entityType.value) {
			//validate entityData is boolean
			if (typeof entityData === common.DATA_TYPE_BOOLEAN) {
				return true
			}
			if (!entityData || (Array.isArray(entityData) && entityData.length === 0)) {
				return false
			}
		}
		return true
	} catch (error) {
		return error
	}
}

const checkEntities = (entityType, entityData) => {
	try {
		if (entityType.has_entities) {
			if (!Array.isArray(entityData)) {
				entityData = entityData ? [entityData] : []
			}

			entityData = entityData.map((item) => {
				return typeof item === 'string' ? { value: item } : item
			})

			const validEntities = entityType.entities.map((e) => e.value)
			const invalidEntities = entityData.filter((entity) => !validEntities.includes(entity.value))
			if (invalidEntities.length > 0) {
				return {
					message: entityType.validations.message || `${entityType.value} is invalid`,
					status: false,
				}
			}
		}
		return { status: true }
	} catch (error) {
		return error
	}
}

const validateRoleAccess = (roles, requiredRoles) => {
	if (!roles || roles.length === 0) return false

	if (!Array.isArray(requiredRoles)) {
		requiredRoles = [requiredRoles]
	}

	return roles.some((role) => requiredRoles.includes(role.title))
}

const convertToString = (value) => {
	return value.toString()
}

const getUniqueElements = (array) => {
	return [...new Set([...array])]
}

const convertToInteger = (value) => {
	value = value.replace(/['"]/g, '')
	return isNaN(value) ? false : parseInt(value, 10)
}

const isLabelValuePair = (item) => {
	return Array.isArray(item)
		? item.every((subItem) => subItem && typeof subItem === 'object' && 'label' in subItem && 'value' in subItem)
		: typeof item === 'object' && 'label' in item && 'value' in item
}

const validateTitle = (title) => {
	// Regex to match titles longer than 256 characters
	const regex = /^.{257,}$/
	return regex.test(title)
}
const validateComment = (comments) => {
	// check if the comment passed to the resource is valid or not
	// check if comment is an array or not and the keys are valid and filled
	const isValidComment =
		Array.isArray(comments) &&
		comments.length > 0 &&
		comments.every(
			(eachComment) =>
				eachComment &&
				typeof eachComment === 'object' &&
				eachComment.hasOwnProperty('text') &&
				eachComment.hasOwnProperty('context') &&
				eachComment.hasOwnProperty('page')
		)
	return isValidComment
}
// apply common.pagination to an array
const paginate = (data, page, size) => {
	// find the start index from page and size
	const startIndex = (page - 1) * size
	// slice the array and return a new array with from starting index to ending index
	return data.slice(startIndex, startIndex + size)
}

/**
 * apply sort to any array of objects. Sort by can be any key in the object and default sort orders can be applied
 * @name sort
 * @param {string} data - Array of objects.
 * @param {Object} sort - Sort object with keys sort_by and order
 * @returns {Object} - Response a sorted array of object based on the sort_by and order
 */
const sort = (data, sort) => {
	const {
		sort_by = common.CREATED_AT, // Default sort_by is 'created_at'
		order = common.SORT_DESC, // Default order is 'desc'
	} = sort || {}

	// Determine if sorting should be by date
	const isDateField = sort_by === common.CREATED_AT || sort_by === common.UPDATED_AT

	// Use _.orderBy with a custom iteratee
	return _.orderBy(
		data,
		[
			(item) => {
				// Apply different sorting logic based on the field type
				const value = item[sort_by]
				return isDateField ? new Date(value) : _.toLower(value)
			},
		],
		[order.toLowerCase()]
	)
}

const isEmpty = (obj) => {
	for (let i in obj) return false
	return true
}

module.exports = {
	composeEmailBody,
	internalSet,
	internalDel,
	internalGet,
	redisSet,
	redisGet,
	redisDel,
	extractEmailTemplate,
	capitalize,
	isNumeric,
	processDbResponse,
	restructureBody,
	validateInput,
	deleteProperties,
	generateWhereClause,
	validateFilters,
	processQueryParametersWithExclusions,
	removeDefaultOrgEntityTypes,
	generateUniqueId,
	removeDefaultOrgCertificates,
	errorObject,
	checkRegexPattern,
	checkRequired,
	checkEntities,
	validateRoleAccess,
	convertToString,
	getUniqueElements,
	isLabelValuePair,
	convertToInteger,
	validateTitle,
	validateComment,
	paginate,
	sort,
	isEmpty,
}

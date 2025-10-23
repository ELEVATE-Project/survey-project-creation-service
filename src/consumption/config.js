/**
 * name : consumption/config.js
 * author : Adithya Dinesh
 * Date : 03-SEP-2025
 * Description : Centralizes consumption service configuration and MongoDB URLs.
 */
const common = require('@constants/common')
const utils = require('@generics/utils')

let projectsMongoDBUrl = null
let surveyMongoDBUrl = null

const consumptionServiceType = process.env.CONSUMPTION_SERVICE || common.CONSUMPTION_SERVICE_SELF

if (consumptionServiceType !== common.CONSUMPTION_SERVICE_SELF) {
	console.log(`Consumption service is set to external. Current value: ${consumptionServiceType}`)
	if (process.env.MONGO_DB_MODE === common.MONGO_DB_MODE_INDIVIDUAL) {
		projectsMongoDBUrl = process.env.PROJECT_MONGO_DB_URL || null
		surveyMongoDBUrl = process.env.SURVEY_MONGO_DB_URL || null
		if (!projectsMongoDBUrl || !surveyMongoDBUrl) {
			throw new Error(
				`PROJECT_MONGO_DB_URL and SURVEY_MONGO_DB_URL are required for MONGO_DB_MODE=${common.MONGO_DB_MODE_INDIVIDUAL}`
			)
		}
	} else if (process.env.MONGO_DB_MODE === common.MONGO_DB_MODE_SHARED) {
		projectsMongoDBUrl = process.env.SHARED_MONGO_DB_URL || null
		surveyMongoDBUrl = process.env.SHARED_MONGO_DB_URL || null
		if (!projectsMongoDBUrl || !surveyMongoDBUrl) {
			throw new Error(`SHARED_MONGO_DB_URL is required for MONGO_DB_MODE=${common.MONGO_DB_MODE_SHARED}`)
		}
	} else {
		throw new Error(
			'MONGO_DB_MODE is not set correctly in the environment variables. It should be either "individual" or "shared".'
		)
	}
}

/**
 * @name fetchConsumptionServiceUrls
 * @description Fetches the consumption service URLs based on the service type and resource type.
 * @param {String} type - type of the resource (e.g., project, survey)
 * @returns {String|null} - Returns the consumption service URL for the given type or null if not found.
 */
const fetchConsumptionServiceUrls = (type = null) => {
	let consumptionUrl = null
	try {
		if (consumptionServiceType !== common.CONSUMPTION_SERVICE_SELF && type) {
			const consumptionBaseUrl = process.env.INTERFACE_SERVICE_HOST
			const serviceMap = {
				[common.PROJECT]: process.env.PROJECT_SERVICE_BASE_URL,
				[common.OBSERVATION]: process.env.SURVEY_SERVICE_BASE_URL,
				[common.OBSERVATION_WITH_RUBRICS]: process.env.SURVEY_SERVICE_BASE_URL,
				[common.SURVEY]: process.env.SURVEY_SERVICE_BASE_URL,
			}
			const baseUrl = serviceMap[type]
			consumptionUrl = baseUrl ? utils.buildUrl(consumptionBaseUrl, baseUrl) || null : null
		}
	} catch (err) {
		console.error('Error fetching consumption service URLs:', err)
		consumptionUrl = null
	}
	return consumptionUrl
}

console.log(`Projects MongoDB ${projectsMongoDBUrl ? 'Fetched' : 'Not Fetched'}`)
console.log(`Survey MongoDB ${surveyMongoDBUrl ? 'Fetched' : 'Not Fetched'}`)

module.exports = {
	consumptionServiceType,
	projectsMongoDBUrl,
	surveyMongoDBUrl,
	fetchConsumptionServiceUrls,
}

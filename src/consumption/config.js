/**
 * name : consumption/config.js
 * author : Adithya Dinesh
 * Date : 03-SEP-2025
 * Description : Centralizes consumption service configuration and MongoDB URLs.
 */
const common = require('@constants/common')

let projectsMongoDBUrl = null
let surveyMongoDBUrl = null

const consumptionServiceType = process.env.CONSUMPTION_SERVICE || common.CONSUMPTION_SERVICE_SELF

if (consumptionServiceType !== common.CONSUMPTION_SERVICE_SELF) {
	console.log(`Consumption service is set to external. Current value: ${consumptionServiceType}`)
	if (process.env.MONGO_DB_MODE === common.MONGO_DB_MODE_INDIVIDUAL) {
		projectsMongoDBUrl = process.env.PROJECT_MONGO_DB_URL || null
		surveyMongoDBUrl = process.env.SURVEY_MONGO_DB_URL || null
	} else if (process.env.MONGO_DB_MODE === common.MONGO_DB_MODE_SHARED) {
		projectsMongoDBUrl = process.env.SHARED_MONGO_DB_URL || null
		surveyMongoDBUrl = process.env.SHARED_MONGO_DB_URL || null
	} else {
		throw new Error(
			'MONGO_DB_MODE is not set correctly in the environment variables. It should be either "individual" or "shared".'
		)
	}
}

console.log(`Projects MongoDB URL: ${projectsMongoDBUrl}`)
console.log(`Survey MongoDB URL: ${surveyMongoDBUrl}`)

module.exports = {
	consumptionServiceType,
	projectsMongoDBUrl,
	surveyMongoDBUrl,
}

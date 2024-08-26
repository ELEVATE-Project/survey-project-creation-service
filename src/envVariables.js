let table = require('cli-table')
const common = require('@constants/common')

let tableData = new table()

let environmentVariables = {
	APPLICATION_PORT: {
		message: 'Required port no',
		optional: false,
	},
	APPLICATION_HOST: {
		message: 'Required host',
		optional: false,
	},
	APPLICATION_ENV: {
		message: 'Required node environment',
		optional: false,
	},
	APPLICATION_BASE_URL: {
		message: 'Required application base url',
		optional: false,
	},
	ACCESS_TOKEN_SECRET: {
		message: 'Required access token secret',
		optional: false,
	},
	KAFKA_COMMUNICATIONS_ON_OFF: {
		message: 'Enable/Disable kafka communications',
		optional: false,
	},
	KAFKA_URL: {
		message: 'Required kafka connectivity url',
		optional: false,
	},
	RESOURCE_KAFKA_PUSH_ON_OFF: {
		message: 'Required kafka connectivity url',
		optional: false,
	},
	KAFKA_GROUP_ID: {
		message: 'Required kafka group id',
		optional: false,
	},
	USER_SERVICE_HOST: {
		message: 'Required user service host',
		optional: false,
	},
	USER_SERVICE_BASE_URL: {
		message: 'Required user service base url',
		optional: false,
	},
	ENABLE_LOG: {
		message: 'log enable or disable',
		optional: true,
	},
	API_DOC_URL: {
		message: 'Required api doc url',
		optional: false,
	},
	INTERNAL_CACHE_EXP_TIME: {
		message: 'Internal Cache Expiry Time',
		optional: false,
	},
	REDIS_HOST: {
		message: 'Redis Host Url',
		optional: false,
	},
	ERROR_LOG_LEVEL: {
		message: 'Required Error log level',
		optional: false,
	},
	DISABLE_LOG: {
		message: 'Required disable log level',
		optional: false,
	},
	DEFAULT_ORG_ID: {
		message: 'Default organization ID',
		optional: false,
	},
	ALLOWED_HOST: {
		message: 'Required CORS allowed host',
		optional: true,
		default: '*',
	},
	AUTH_METHOD: {
		message: 'Required authentication method',
		optional: true,
		default: common.AUTH_METHOD.JWT_ONLY,
	},
	REVIEW_REQUIRED: {
		message: 'Required Review Required field',
		optional: false,
		default: true,
	},
	SHOW_REVIEWER_LIST: {
		message: 'Required Show Reviewer field',
		optional: false,
		default: true,
	},
	MIN_APPROVAL: {
		message: 'Required Minimum Approval field',
		optional: false,
		default: common.MIN_APPROVAL,
	},
	REVIEW_TYPE: {
		message: 'Required Review Type field',
		optional: false,
		default: common.REVIEW_TYPE_SEQUENTIAL,
	},
	ORGANIZATION_READ_ENDPOINT: {
		message: 'Required Organization read API end-point field',
		optional: false,
	},
	USER_LIST_ENDPOINT: {
		message: 'Required user list API end-point field',
		optional: false,
	},
	USER_PROFILE_DETAILS_ENDPOINT: {
		message: 'Required user read API end-point field',
		optional: false,
	},
	CLOUD_STORAGE_PROVIDER: {
		message: 'Require cloud storage provider',
		optional: false,
	},
	CLOUD_STORAGE_SECRET: {
		message: 'Require client storage provider identity',
		optional: false,
	},
	CLOUD_STORAGE_BUCKETNAME: {
		message: 'Require client storage bucket name',
		optional: false,
	},
	PUBLIC_BASE_URL: {
		message: 'Public Base Url required',
		optional: true,
		default: '',
	},
	RESOURCE_TYPES: {
		message: 'Resource types required',
		optional: false,
	},
	MAX_PROJECT_TASK_COUNT: {
		message: 'Maximum task count is required',
		optional: false,
		default: 10,
	},
	CONSUMPTION_SERVICE: {
		message: 'Consumption service is required',
		optional: false,
	},
	PROJECT_PUBLISH_KAFKA_TOPIC: {
		message: 'Required project publish kafka topic',
		optional: true,
		requiredIf: {
			key: 'RESOURCE_KAFKA_PUSH_ON_OFF',
			operator: 'EQUALS',
			value: 'ON',
		},
	},
	MAX_BODY_LENGTH_FOR_UPLOAD: {
		message: 'Maximum body length for file upload is required',
		optional: false,
		default: 5242880, //5mb in bytes
	},
	RESOURCE_AUTO_SAVE_TIMER: {
		message: 'Resource auto save interval is required',
		optional: false,
		default: 30000, //30000 millisec
	},
	MAX_RESOURCE_NOTE_LENGTH: {
		message: 'Resource note max length is required',
		optional: true,
		default: 256, //256 characters
	},
	DEFAULT_REVIEWER_ROLE: {
		message: 'Default reviewer role is required',
		optional: true,
		default: 'reviewer',
	},
	INTERFACE_SERVICE_HOST: {
		message: 'Interface Service host address',
		optional: false,
	},
	INTERFACE_BASE_URL: {
		message: 'Interface Service base url',
		optional: true,
		default: '/interface/',
	},
	BROWSE_EXISTING_END_POINT: {
		message: 'Browse Existing list end point',
		optional: true,
		requiredIf: {
			key: 'CONSUMPTION_SERVICE',
			operator: 'NOT_EQUALS',
			value: 'self',
		},
	},
}

let success = true

module.exports = function () {
	Object.keys(environmentVariables).forEach((eachEnvironmentVariable) => {
		let tableObj = {
			[eachEnvironmentVariable]: 'PASSED',
		}

		let keyCheckPass = true
		let validRequiredIfOperators = ['EQUALS', 'NOT_EQUALS']

		if (
			environmentVariables[eachEnvironmentVariable].optional === true &&
			environmentVariables[eachEnvironmentVariable].requiredIf &&
			environmentVariables[eachEnvironmentVariable].requiredIf.key &&
			environmentVariables[eachEnvironmentVariable].requiredIf.key != '' &&
			environmentVariables[eachEnvironmentVariable].requiredIf.operator &&
			validRequiredIfOperators.includes(environmentVariables[eachEnvironmentVariable].requiredIf.operator) &&
			environmentVariables[eachEnvironmentVariable].requiredIf.value &&
			environmentVariables[eachEnvironmentVariable].requiredIf.value != ''
		) {
			switch (environmentVariables[eachEnvironmentVariable].requiredIf.operator) {
				case 'EQUALS':
					if (
						process.env[environmentVariables[eachEnvironmentVariable].requiredIf.key] ===
						environmentVariables[eachEnvironmentVariable].requiredIf.value
					) {
						environmentVariables[eachEnvironmentVariable].optional = false
					}
					break
				case 'NOT_EQUALS':
					if (
						process.env[environmentVariables[eachEnvironmentVariable].requiredIf.key] !=
						environmentVariables[eachEnvironmentVariable].requiredIf.value
					) {
						environmentVariables[eachEnvironmentVariable].optional = false
					}
					break
				default:
					break
			}
		}

		if (environmentVariables[eachEnvironmentVariable].optional === false) {
			if (!process.env[eachEnvironmentVariable] || process.env[eachEnvironmentVariable] == '') {
				success = false
				keyCheckPass = false
			} else if (
				environmentVariables[eachEnvironmentVariable].possibleValues &&
				Array.isArray(environmentVariables[eachEnvironmentVariable].possibleValues) &&
				environmentVariables[eachEnvironmentVariable].possibleValues.length > 0
			) {
				if (
					!environmentVariables[eachEnvironmentVariable].possibleValues.includes(
						process.env[eachEnvironmentVariable]
					)
				) {
					success = false
					keyCheckPass = false
					environmentVariables[eachEnvironmentVariable].message += ` Valid values - ${environmentVariables[
						eachEnvironmentVariable
					].possibleValues.join(', ')}`
				}
			}
		}

		if (
			(!process.env[eachEnvironmentVariable] || process.env[eachEnvironmentVariable] == '') &&
			environmentVariables[eachEnvironmentVariable].default &&
			environmentVariables[eachEnvironmentVariable].default != ''
		) {
			process.env[eachEnvironmentVariable] = environmentVariables[eachEnvironmentVariable].default
		}

		if (!keyCheckPass) {
			if (environmentVariables[eachEnvironmentVariable].message !== '') {
				tableObj[eachEnvironmentVariable] = environmentVariables[eachEnvironmentVariable].message
			} else {
				tableObj[eachEnvironmentVariable] = `FAILED - ${eachEnvironmentVariable} is required`
			}
		}

		tableData.push(tableObj)
	})

	console.log(tableData.toString())

	return {
		success: success,
	}
}

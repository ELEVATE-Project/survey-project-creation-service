// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const orgExtensionQueries = require('@database/queries/organizationExtensions')
const reviewStageQueries = require('@database/queries/reviewStage')
const { UniqueConstraintError } = require('sequelize')
const responses = require('@helpers/responses')
const _ = require('lodash')
const userRequests = require('@requests/user')
const utils = require('@generics/utils')
const organizationExtensionsQueries = require('@database/queries/organizationExtensions')
const organizationConfigQueries = require('@database/queries/organizationConfig')
module.exports = class orgExtensionsHelper {
	/**
	 * Create Organization Config.
	 * @method
	 * @name createConfig
	 * @param {Object} bodyData - Organization Config body data.
	 * @returns {JSON} - Organization Config created response.
	 */

	static async createConfig(bodyData, orgCode, tenantCode) {
		try {
			bodyData.organization_code = orgCode
			bodyData.tenant_code = tenantCode
			const { resource_type, review_stages, review_type, data_managers, program_managers } = bodyData
			// check if body have data_managers
			if (data_managers?.length) {
				await organizationConfigQueries.upsert(
					{
						organization_code: orgCode,
						tenant_code: tenantCode,
						meta: { data_managers },
						updated_at: new Date(),
					},
					{ organization_code: orgCode, tenant_code: tenantCode }
				)
			}
			if (program_managers?.length) {
				await organizationConfigQueries.upsert(
					{
						organization_code: orgCode,
						tenant_code: tenantCode,
						meta: { program_managers },
						updated_at: new Date(),
					},
					{ organization_code: orgCode, tenant_code: tenantCode }
				)
			}
			const validResourceTypes = process.env.RESOURCE_TYPES.split(',')
			if (!validResourceTypes.includes(resource_type)) {
				return responses.failureResponse({
					message: `resource_type ${resource_type} is not a valid`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Check if review_stages is not null, undefined, not an array, empty or invalid
			if (review_type === common.REVIEW_TYPE_SEQUENTIAL) {
				const isValidReviewStages =
					Array.isArray(review_stages) &&
					review_stages.length > 0 &&
					review_stages.every(
						(eachStage) =>
							eachStage &&
							typeof eachStage === 'object' &&
							!Array.isArray(eachStage) &&
							eachStage.hasOwnProperty('role') &&
							eachStage.hasOwnProperty('level')
					)

				if (!isValidReviewStages) {
					return responses.failureResponse({
						message: 'REVIEW_STAGES_INVALID',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				try {
					const createReviewStages = review_stages.map((stage) => ({
						...stage,
						organization_code: orgCode,
						tenant_code: tenantCode,
						resource_type,
					}))

					await reviewStageQueries.bulkCreate(createReviewStages)
				} catch (error) {
					return responses.failureResponse({
						message: error.message,
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
			}

			const orgExtension = await orgExtensionQueries.create(bodyData)
			if (!orgExtension?.id) {
				return responses.failureResponse({
					message: 'FAILED_TO_CREATE_CONFIG',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'CONFIG_ADDED_SUCCESSFULLY',
				result: orgExtension,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'CONFIG_ALREADY_EXIST',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update Organization Config.
	 * @method
	 * @name updateConfig
	 * @param {Object} bodyData - Organization config body data.
	 * @param {String} id - config id.
	 * @param {String} orgCode - organization code
	 * @param {String} tenantCode - tenant code
	 * @returns {JSON} - Organization Config updated response.
	 */

	static async updateConfig(id, resource_type, bodyData, orgCode, tenantCode) {
		try {
			//validate resource type
			const validResourceTypes = process.env.RESOURCE_TYPES.split(',')
			if (!validResourceTypes.includes(resource_type)) {
				return responses.failureResponse({
					message: `resource_type ${resource_type} is not a valid`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const { review_stages, review_type, data_managers, program_managers } = bodyData

			// check if body have data_managers
			if (data_managers?.length) {
				await organizationConfigQueries.upsert(
					{
						organization_code: orgCode,
						tenant_code: tenantCode,
						meta: { data_managers },
						updated_at: new Date(),
					},
					{ organization_code: orgCode, tenant_code: tenantCode }
				)
			}

			// check if body have program_managers
			if (program_managers?.length) {
				await organizationConfigQueries.upsert(
					{
						organization_code: orgCode,
						tenant_code: tenantCode,
						meta: { program_managers },
						updated_at: new Date(),
					},
					{ organization_code: orgCode, tenant_code: tenantCode }
				)
			}

			const filter = {
				id: id,
				resource_type: resource_type,
				organization_code: orgCode,
				tenant_code: tenantCode,
			}

			if (review_type === common.REVIEW_TYPE_SEQUENTIAL) {
				// Fetch existing review stages
				const existingReviewStages = await reviewStageQueries.findAll({
					resource_type: resource_type,
					organization_code: orgCode,
					tenant_code: tenantCode,
				})

				// Check if review_stages is not null, undefined, not an array, empty or invalid
				const isValidReviewStages =
					Array.isArray(review_stages) &&
					review_stages.length > 0 &&
					review_stages.every(
						(eachStage) =>
							eachStage &&
							typeof eachStage === 'object' &&
							!Array.isArray(eachStage) &&
							eachStage.hasOwnProperty('role') &&
							eachStage.hasOwnProperty('level')
					)

				if (existingReviewStages.length === 0 && !isValidReviewStages) {
					return responses.failureResponse({
						message: 'REVIEW_STAGES_INVALID',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				//review stage creation
				if (isValidReviewStages) {
					// Identify new review stages to add
					const newReviewStages = review_stages.filter(
						(stage) =>
							!existingReviewStages.some(
								(existingStage) =>
									existingStage.role === stage.role &&
									existingStage.level === stage.level &&
									existingStage.resource_type === resource_type &&
									existingStage.organization_code === orgCode &&
									existingStage.tenant_code === tenantCode
							)
					)

					// Add new review stages
					if (newReviewStages.length > 0) {
						const createReviewStages = newReviewStages.map((stage) => ({
							...stage,
							organization_code: orgCode,
							tenant_code: tenantCode,
							resource_type,
						}))
						try {
							await reviewStageQueries.bulkCreate(createReviewStages)
						} catch (error) {
							return responses.failureResponse({
								message: error.message,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
							})
						}
					}
				}
			}

			const [updateCount, updatedConfig] = await orgExtensionQueries.update(filter, bodyData, {
				returning: true,
				raw: true,
			})

			if (updateCount == 0) {
				return responses.failureResponse({
					message: 'ORG_CONFIG_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ORG_CONFIG_UPDATED',
				result: updatedConfig,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get all details of org from the user service.
	 * @name fetchOrganizationDetails
	 * @param {Array} organization_codes - array of organization_codes.
	 * @returns {Object} - Response contain object of org details
	 */
	static async fetchOrganizationDetails(OrganizationCodes, tenantCode) {
		const orgDetailsResponse = await userRequests.listOrganization(OrganizationCodes, tenantCode)
		let orgDetails = {}

		if (orgDetailsResponse.success && orgDetailsResponse.data?.result?.length > 0) {
			orgDetails = _.keyBy(orgDetailsResponse.data.result, 'code')
		}
		return orgDetails
	}

	/**
	 * Get Organization and instance level Configs.
	 * @method
	 * @name getConfig
	 * @returns {JSON} - List of configs based on orgId of user as response.
	 */
	static async getConfig(organization_code, tenantCode) {
		try {
			let orgExtenstionData = {}
			let configData = []
			// define filter
			const filter = {
				organization_code,
				tenant_code: tenantCode,
			}
			let result = {
				config: {},
				resource: [],
				instance: {
					auto_save_interval: utils.convertToInteger(process.env.RESOURCE_AUTO_SAVE_TIMER),
					note_length: utils.convertToInteger(process.env.MAX_RESOURCE_NOTE_LENGTH),
					is_auth_token_bearer: process.env.IS_AUTH_TOKEN_BEARER === 'true',
				},
			}
			// fetch org config for organization_code
			const orgConfig = await organizationConfigQueries.findOne(
				{
					organization_code,
				},
				['meta']
			)

			if (orgConfig?.meta && Object.keys(orgConfig.meta).length > 0) {
				result.config = orgConfig?.meta
			}

			if (orgConfig?.meta?.data_managers?.length == 0 || orgConfig?.meta?.data_managers?.length == undefined) {
				result.config.data_managers = process.env.DEFAULT_DATA_MANAGERS.split(',')
			}

			if (
				orgConfig?.meta?.program_managers?.length == 0 ||
				orgConfig?.meta?.program_managers?.length == undefined
			) {
				result.config.program_managers = process.env.DEFAULT_PROGRAM_MANAGERS.split(',')
			}

			// attributes to fetch from organisation Extenstion
			const attributes = common.INSTANCE_LEVEL_CONFIG_ATTRIBUTES

			// fetch the current list of resources
			const resourceListArr = process.env.RESOURCE_TYPES.split(',')

			// instance level configurations from env as default configs
			const default_configs = {
				review_required: process.env.REVIEW_REQUIRED === 'true' ? true : false,
				show_reviewer_list: process.env.SHOW_REVIEWER_LIST === 'true' ? true : false,
				min_approval: Number(process.env.MIN_APPROVAL),
				review_type:
					process.env.REVIEW_TYPE.toUpperCase() === common.REVIEW_TYPE_SEQUENTIAL
						? common.REVIEW_TYPE_SEQUENTIAL
						: common.REVIEW_TYPE_PARALLEL,
				review_required_after_publish: process.env.REVIEW_REQUIRED_AFTER_PUBLISH === 'true' ? true : false,
			}

			// fetch the configuration from Organization extension for the user's organization
			orgExtenstionData = await organizationExtensionsQueries.findMany(filter, attributes)
			// get the list of resource types not set by the org-admin
			let resourceTypeFromDB = []

			// fetch the config data
			configData = resourceListArr
				.map((resourceType) => {
					const filterData = orgExtenstionData.filter((orgExt) => {
						if (orgExt.resource_type.toLowerCase() === resourceType.toLowerCase()) {
							resourceTypeFromDB.push(orgExt.resource_type)
							return {
								review_required: orgExt.review_required,
								show_reviewer_list: orgExt.show_reviewer_list,
								min_approval: orgExt.min_approval,
								review_type: orgExt.review_type,
								resource_type: orgExt.resource_type,
								review_required_after_publish: orgExt.review_required_after_publish,
							}
						}
					})
					return filterData
				})
				.flat()

			// check and fill for the missing configs from DB
			const missedResourceTypes = _.difference(resourceListArr, resourceTypeFromDB)
				.map((resourceType) => {
					return {
						...default_configs,
						resource_type: resourceType,
					}
				})
				.flat()

			configData = configData.length > 0 ? _.concat(configData, missedResourceTypes) : missedResourceTypes

			_.forEach(configData, (item) => {
				if (item.resource_type === common.PROJECT) {
					item.max_task_count = utils.convertToInteger(process.env.MAX_PROJECT_TASK_COUNT)
					item.observation_link_regex = process.env.OBSERVATION_DEEP_LINK_REGEX
				}
			})

			result.resource = configData
			// return success message
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CONFIGS_FETCHED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			// return error message
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'CONFIG_FETCH_FAILED',
				result: [],
			})
		}
	}
}

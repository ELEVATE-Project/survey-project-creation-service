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
const resourceQueries = require('@database/queries/resources')
const Op = require('sequelize').Op
const path = require('path')
const fs = require('fs')
module.exports = class orgExtensionsHelper {
	/**
	 * Create Organization Config.
	 * @method
	 * @name createConfig
	 * @param {Object} bodyData - Organization Config body data.
	 * @param {String} orgCode - organization code
	 * @param {String} tenantCode - tenant code
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
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
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
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Get all details of org from the user service.
	 * @name fetchOrganizationDetails
	 * @param {Array} organization_codes - array of organization_codes.
	 * @param {String} tenantCode - tenant code
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
			let configData = []
			// define filter
			const filter = {
				organization_code: {
					[Op.in]: [organization_code, process.env.DEFAULT_ORGANIZATION_CODE].filter(Boolean),
				},
				tenant_code: tenantCode,
			}
			let result = {
				config: {
					data_managers: process.env.DEFAULT_DATA_MANAGERS?.split(',') || [],
					program_managers: process.env.DEFAULT_PROGRAM_MANAGERS?.split(',') || [],
					targeting_criteria: await this.getTargetingCriteriaConfig(),
				},
				resource: [],
				instance: {
					auto_save_interval: utils.convertToInteger(process.env.RESOURCE_AUTO_SAVE_TIMER),
					note_length: utils.convertToInteger(process.env.MAX_RESOURCE_NOTE_LENGTH),
					is_auth_token_bearer: process.env.IS_AUTH_TOKEN_BEARER === 'true',
				},
			}
			// fetch org config for organization_code (prioritize user's org over default)
			const orgConfigs = await organizationConfigQueries.findAll(filter, [
				'meta',
				'organization_code',
				'external_resource_visibility_policy',
				'resource_visibility_policy',
			])

			// Find user's org config first, fallback to default org config
			const userOrgConfig = orgConfigs?.find((config) => config.organization_code === organization_code)
			const defaultOrgConfig = orgConfigs?.find(
				(config) => config.organization_code === process.env.DEFAULT_ORGANIZATION_CODE
			)
			const selectedConfig = userOrgConfig || defaultOrgConfig

			// Set meta configuration
			if (selectedConfig?.meta && typeof selectedConfig.meta === 'object') {
				result.config = selectedConfig.meta
			}

			// Set default managers if not present
			if (!result.config.data_managers?.length) {
				result.config.data_managers = process.env.DEFAULT_DATA_MANAGERS?.split(',') || []
			}

			if (!result.config.program_managers?.length) {
				result.config.program_managers = process.env.DEFAULT_PROGRAM_MANAGERS?.split(',') || []
			}

			// Set organization policy (prioritize user's org)
			result.config.external_resource_visibility_policy =
				userOrgConfig?.external_resource_visibility_policy ||
				defaultOrgConfig?.external_resource_visibility_policy ||
				undefined

			result.config.resource_visibility_policy =
				userOrgConfig?.resource_visibility_policy || defaultOrgConfig?.resource_visibility_policy || undefined

			// attributes to fetch from organisation Extenstion
			let attributes = [...common.INSTANCE_LEVEL_CONFIG_ATTRIBUTES, 'tenant_code', 'organization_code']

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
				enable_entity_tagging: process.env.ENABLE_ENTITY_TAGGING_IN_PROJECTS === 'true' ? true : false,
				enable_task_start_end_dates:
					process.env.ENABLE_TASK_START_END_DATE_IN_PROJECTS === 'true' ? true : false,
			}

			// fetch the configuration from Organization extension for the user's organization
			let orgExtensionData = await organizationExtensionsQueries.findMany(filter, attributes)

			// Separate user org and default org extensions
			const userOrgExtensions =
				orgExtensionData?.filter((extension) => extension.organization_code === organization_code) || []
			const defaultOrgExtensions =
				orgExtensionData?.filter(
					(extension) => extension.organization_code === process.env.DEFAULT_ORGANIZATION_CODE
				) || []

			// Track which resource types have been configured
			let resourceTypeFromDB = []

			// Build config for each resource type with proper fallback chain
			configData = resourceListArr
				.map((resourceType) => {
					// Try to find config in user's org first
					let orgExtConfig = userOrgExtensions.find(
						(ext) => ext.resource_type.toLowerCase() === resourceType.toLowerCase()
					)

					// If not found in user org, try default org
					if (!orgExtConfig) {
						orgExtConfig = defaultOrgExtensions.find(
							(ext) => ext.resource_type.toLowerCase() === resourceType.toLowerCase()
						)
					}

					// If found in either org, use it
					if (orgExtConfig) {
						resourceTypeFromDB.push(resourceType)
						return {
							review_required: orgExtConfig.review_required,
							show_reviewer_list: orgExtConfig.show_reviewer_list,
							min_approval: orgExtConfig.min_approval,
							review_type: orgExtConfig.review_type,
							resource_type: orgExtConfig.resource_type,
							review_required_after_publish: orgExtConfig.review_required_after_publish,
							enable_entity_tagging: orgExtConfig.enable_entity_tagging,
							enable_task_start_end_dates: orgExtConfig.enable_task_start_end_dates,
						}
					}

					// If not found in any org, use instance-level defaults
					return {
						...default_configs,
						resource_type: resourceType,
					}
				})
				.flat()

			_.forEach(configData, (item) => {
				if (item.resource_type === common.PROJECT) {
					item.max_task_count = utils.convertToInteger(process.env.MAX_PROJECT_TASK_COUNT)
					item.observation_link_regex = process.env.OBSERVATION_DEEP_LINK_REGEX || ''
					item.project_reflection_task_redirect_url = process.env.PROJECT_REFLECTION_TASK_REDIRECT_URL || ''
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

	/**
	 * createOrUpdate Organization Config.
	 * @method
	 * @name createOrUpdate
	 * @param {Object} bodyData - Organization Config body data.
	 * @param {String} orgCode - organization code
	 * @param {String} tenantCode - tenant code
	 * @param {Boolean} skipReviewCreation - skip review and orgeExtension creation
	 * @returns {JSON} - Organization Config created response.
	 */

	static async createOrUpdate(bodyData, orgCode, tenantCode) {
		try {
			// Validate org and tenant codes
			if (!orgCode?.trim() || !tenantCode?.trim()) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'ORGANIZATION_CODE_AND_TENANT_CODE_REQUIRED',
				})
			}
			orgCode = orgCode.trim()
			tenantCode = tenantCode.trim()
			// Prepare base update data
			const updateData = {
				organization_code: orgCode,
				tenant_code: tenantCode,
				meta: {},
				updated_at: new Date(),
			}

			const { data_managers, program_managers, resource_visibility_policy, external_resource_visibility_policy } =
				bodyData || {}

			// Meta construction (only non-empty arrays)
			if (Array.isArray(data_managers) && data_managers.length) {
				updateData.meta.data_managers = data_managers
			}
			if (Array.isArray(program_managers) && program_managers.length) {
				updateData.meta.program_managers = program_managers
			}

			// Policy handling using helper
			const orgPolicies = {
				resource_visibility_policy,
				external_resource_visibility_policy,
			}

			for (const [key, value] of Object.entries(orgPolicies)) {
				const policy = utils.setPolicy(value)
				if (policy) updateData[key] = policy
			}

			// Fetch existing config (limit fields for efficiency)
			const existingConfig = await organizationConfigQueries.findOne(
				{ organization_code: orgCode, tenant_code: tenantCode },
				['organization_code']
			)

			// Upsert logic
			if (existingConfig) {
				// Update (omit meta if empty)
				if (!Object.keys(updateData.meta).length) delete updateData.meta

				const [updatedCount] = await organizationConfigQueries.update(
					{ organization_code: orgCode, tenant_code: tenantCode },
					updateData
				)

				return updatedCount > 0
					? responses.successResponse({
							statusCode: httpStatusCode.ok,
							message: 'CONFIG_UPDATED_SUCCESSFULLY',
					  })
					: responses.failureResponse({
							statusCode: httpStatusCode.bad_request,
							message: 'CONFIG_UPDATE_FAILED',
					  })
			}

			// Create new config
			const created = await organizationConfigQueries.upsert(updateData, {
				organization_code: orgCode,
				tenant_code: tenantCode,
			})

			return created
				? responses.successResponse({
						statusCode: httpStatusCode.created,
						message: 'CONFIG_ADDED_SUCCESSFULLY',
				  })
				: responses.failureResponse({
						statusCode: httpStatusCode.bad_request,
						message: 'CONFIG_CREATION_FAILED',
				  })
		} catch (error) {
			// Handle known errors
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'CONFIG_ALREADY_EXIST',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	static async updateRelatedOrgs(bodyData, orgCode, tenantCode) {
		try {
			if (bodyData?.hasOwnProperty('related_org_details')) {
				//get the code to store it in  visibleToOrganizations key
				const visibleOrg = bodyData.related_org_details
					?.map((eachValue) => eachValue?.code?.trim())
					.filter((code) => code)

				let updateData = {
					organization_code: orgCode,
					tenant_code: tenantCode,
					visible_to_organizations: visibleOrg,
					updated_at: new Date(),
				}

				const [updatedCount] = await resourceQueries.updateOne(
					{ organization_code: orgCode, tenant_code: tenantCode, is_reusable: true },
					updateData
				)

				if (updatedCount > 0) {
					return responses.successResponse({
						statusCode: httpStatusCode.ok,
						message: 'RELATED_ORGS_UPDATED_SUCCESSFULLY',
					})
				} else {
					// fallback: something went wrong during update
					return responses.failureResponse({
						statusCode: httpStatusCode.bad_request,
						message: 'RELATED_ORGS_UPDATE_FAILED',
					})
				}
			} else {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'NO_RELATED_ORGS_TO_UPDATE',
				})
			}
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Get targeting criteria configuration from config file
	 * @method
	 * @name getTargetingCriteriaConfig
	 * @returns {Object} - Targeting criteria configuration object
	 * @private
	 */
	static async getTargetingCriteriaConfig() {
		try {
			let targetingConfig = {}

			// Return empty config if no config file path is defined
			if (!process.env.AUTH_CONFIG_FILE_PATH) {
				return targetingConfig
			}

			const configFilePath = path.resolve(PROJECT_ROOT_DIRECTORY, process.env.AUTH_CONFIG_FILE_PATH)

			// Check if config file exists
			if (!fs.existsSync(configFilePath)) {
				return targetingConfig
			}

			try {
				const rawData = fs.readFileSync(configFilePath, 'utf8')
				const configData = JSON.parse(rawData)

				if (configData?.targeting_criteria) {
					targetingConfig = configData?.targeting_criteria || {}
				}
			} catch (parseError) {
				console.error('Error parsing config.json:', parseError)
			}

			return targetingConfig
		} catch (error) {
			console.error('Error in getTargetingCriteriaConfig:', error)
			return {}
		}
	}
}

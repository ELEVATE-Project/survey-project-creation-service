/**
 * name : rollouts.js
 * author : Priyanka Pradeep
 * created-date : 26-Nov-2024
 * Description : Rollouts Helper.
 */
const db = require('@database/models/index')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const rolloutQueries = require('@database/queries/rollouts')
const resourceService = require('@services/resource')
const resourceQueries = require('@database/queries/resources')
const orgExtensionService = require('@services/organization-extension')
const filesService = require('@services/files')
const userRequests = require('@requests/user')
const { Op } = require('sequelize')
const kafkaCommunication = require('@generics/kafka-communication')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const utils = require('@generics/utils')
const targetingHelper = require('@helpers/targetingCriteria')

module.exports = class RolloutsHelper {
	/**
	 * Rollout create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - rollout id
	 */
	static async create(bodyData, loggedInUserId, org_code, tenant_code, isSolutionType = false) {
		const transaction = await db.sequelize.transaction()
		try {
			//validate the resource
			let resource = await resourceQueries.findOne({
				id: bodyData.resource_id,
				organization_code: org_code,
				stage: common.RESOURCE_STAGE_COMPLETION,
				tenant_code: tenant_code,
			})

			if (!resource?.id) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let rolloutData = {
				title: bodyData.title,
				resource_type: resource.type,
				resource_id: resource.id,
				status: common.ROLLOUT_STATUS_PENDING,
				type: isSolutionType ? common.ROLLOUT_TYPE_SOLUTION : common.ROLLOUT_TYPE_PROGRAM,
				user_id: loggedInUserId,
				organization_code: org_code,
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
				tenant_code: tenant_code,
			}

			if (bodyData.start_date) rolloutData.start_date = bodyData.start_date
			if (bodyData.end_date) rolloutData.end_date = bodyData.end_date
			if (isSolutionType === true) rolloutData.parent_id = bodyData.parent_id

			let rolloutCreate
			try {
				//create rollout
				rolloutCreate = await rolloutQueries.create(rolloutData)

				// upload to blob
				const rolloutId = rolloutCreate.id

				const rolloutUploadStatus = await resourceService.uploadToCloud(
					common.ROLLOUT_UPLOAD_FILE_NAME,
					org_code,
					tenant_code,
					rolloutCreate.id,
					common.ROLL_OUT,
					loggedInUserId,
					bodyData
				)

				if (
					rolloutUploadStatus.result.status == httpStatusCode.ok ||
					rolloutUploadStatus.result.status == httpStatusCode.created
				) {
					let filter = {
						id: rolloutId,
						organization_code: org_code,
						tenant_code: tenant_code,
					}

					let updateData = {
						updated_by: loggedInUserId,
						blob_path: rolloutUploadStatus.blob_path,
					}

					const [updateCount] = await rolloutQueries.updateOne(filter, updateData, {
						returning: true,
						raw: true,
						transaction,
					})

					if (updateCount === 0) {
						await transaction.rollback()
						return responses.failureResponse({
							message: 'ROLLOUT_NOT_FOUND',
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
						})
					}
				} else {
					// If file upload fails, rollback the transaction and delete the created entry
					if (rolloutCreate?.id)
						await rolloutQueries.deleteOne(rolloutCreate.id, rolloutCreate.organization_code, tenant_code)
					await transaction.rollback()
					throw new Error('FILE_UPLOADED_FAILED')
				}
			} catch (error) {
				if (rolloutCreate?.id)
					await rolloutQueries.deleteOne(rolloutCreate.id, rolloutCreate.organization_code, tenant_code)
				await transaction.rollback()
				return responses.failureResponse({
					message: error.message || error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Commit the transaction if everything goes well
			await transaction.commit()

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ROLLOUT_SAVED_SUCCESSFULLY',
				result: { id: rolloutCreate.id },
			})
		} catch (error) {
			await transaction.rollback() // Rollback transaction on any error
			throw error
		} finally {
			await transaction.cleanup()
		}
	}

	/**
	 * Rollout details
	 * @method
	 * @name details
	 * @param {String} rolloutId - Rollout id
	 * @param {String} loggedInUserId - User id
	 * @param {String} org_code - Organization id
	 * @param {String} tenant_code - Tenant code
	 * @param {String} userToken - User token
	 * @param {Boolean} returnBlobPath - Return blob path
	 * @param {Boolean} getResourceData - Get resource data
	 * @returns {JSON} - Rollout Details
	 */
	static async details(
		rolloutId,
		loggedInUserId,
		org_code,
		tenant_code,
		returnBlobPath = false,
		getResourceData = false,
		userToken = ''
	) {
		try {
			let result = {
				organization: {},
			}

			const filter = {
				id: rolloutId,
				organization_code: org_code,
				user_id: loggedInUserId,
				tenant_code: tenant_code,
			}

			const rollout = await rolloutQueries.findOne(filter, {}, getResourceData)

			if (!rollout?.id) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			let resourceData = {}
			// return resource details for internal calls based on getResourceData flag
			if (getResourceData && rollout?.resource_details?.blob_path) {
				const response = await filesService.fetchJsonFromCloud(rollout?.resource_details?.blob_path)
				if (
					response.statusCode === httpStatusCode.ok &&
					response.result &&
					Object.keys(response.result).length > 0
				) {
					resourceData = response.result
				}
			}

			//get the data from storage
			if (rollout.blob_path) {
				const response = await filesService.fetchJsonFromCloud(rollout.blob_path)
				if (
					response.statusCode === httpStatusCode.ok &&
					response.result &&
					Object.keys(response.result).length > 0
				) {
					let resultData = {
						...response.result,
						...rollout,
					}

					if (!returnBlobPath) {
						delete resultData['blob_path']
					}
					resultData.viewers = []

					// fetch the user if viewer is present
					if (response?.result?.viewers?.length > 0) {
						const viewerUserIds = response.result.viewers
						const userDetails = await this.fetchUserDetails(viewerUserIds, org_code, tenant_code, userToken)

						if (userDetails && Object.keys(userDetails).length > 0) {
							resultData.viewers = viewerUserIds.map((user) => {
								return userDetails[user]
							})
						}
					}

					// fetch the org details from user service
					const organizationDetails = await orgExtensionService.fetchOrganizationDetails(
						[rollout.organization_code],
						rollout.tenant_code
					)
					if (organizationDetails?.[rollout.organization_code]) {
						resultData.organization = _.pick(organizationDetails[rollout.organization_code], [
							'id',
							'name',
							'code',
						])
					}
					result = { ...resultData }
				}
			}
			if (result?.resource_details && Object.keys(result?.resource_details).length > 0) {
				result.resource_details = { ...result.resource_details, ...resourceData }
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ROLLOUT_FETCHED_SUCCESSFULLY',
				result: result,
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
	 * Get Data Managers list
	 * @method
	 * @name getDataManagers
	 * @param org_code  - Organization Id
	 * @param {String} tenant_code -tenant_code
	 * @param pageNo - Page number
	 * @param pageSize - Page size
	 * @returns {JSON} - List of data managers
	 */
	static async getDataManagers(user_id, org_code, tenant_code, pageNo, pageSize, userToken = '') {
		try {
			// get org config based on org_code
			const orgConfigs = await orgExtensionService.getConfig(org_code, tenant_code)
			// identify the roles have data manager access
			const dataManagerRoles = orgConfigs?.result?.config?.data_managers
			// fetch the users from user service
			const dataManagersList = await userRequests.list(
				dataManagerRoles.join(','),
				pageNo,
				pageSize,
				'',
				org_code,
				tenant_code,
				{},
				userToken
			)
			let result = {
				data: [],
				count: 0,
			}

			if (dataManagersList.success && dataManagersList?.data?.result?.data.length) {
				result.data = dataManagersList.data?.result?.data
					.filter((user) => user.id != user_id)
					.map((user) => {
						return {
							id: user.id,
							email: user?.email || '',
							name: user?.name,
							username: user?.username,
							phone_code: user?.phone_code || '',
							phone: user?.phone || '',
							status: user?.status,
							organization: user?.user_organizations?.[0]?.organization || {},
							organization_code: user?.user_organizations?.[0]?.organization_code || '',
						}
					})

				result.count = dataManagersList.data?.result?.count
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'DATA_MANAGER_LIST_FETCHED',
				result,
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**Rollout List
	 * @method
	 * @name list
	 * @param {String} loggedInUserId
	 * @param {Object} queryParams
	 * @param {String} searchText
	 * @param {Integer} page
	 * @param {Integer} limit
	 * @param {String} organization_code
	 * @param {String} tenant_code - tenant code
	 * @param {String} userToken
	 * @returns {JSON} - List of rollouts
	 **/
	static async list(
		loggedInUserId,
		queryParams,
		searchText = '',
		page,
		limit,
		organization_code,
		tenant_code,
		userToken = ''
	) {
		try {
			let result = {
				data: [],
				count: 0,
			}

			let filters = {
				organization_code,
				user_id: loggedInUserId,
				type: common.ROLLOUT_TYPE_PROGRAM,
				tenant_code: tenant_code,
			}

			if (searchText && searchText != '') {
				filters.title = {
					[Op.iLike]: '%' + searchText + '%',
				}
			}

			// Fetch all program IDs to exclude their associated resources
			const programRollouts = await rolloutQueries.findAll(
				{
					resource_type: common.RESOURCE_TYPE_PROGRAM,
					organization_code: organization_code,
					tenant_code: tenant_code,
				},
				{ attributes: ['id'] }
			)

			const programRolloutIds = programRollouts.map((rollout) => rollout.id)

			//filter based on multiple resource_types
			//Remove resource type program hence its a listing for single resource rollout
			let resourceTypes =
				queryParams.resource_type && queryParams.resource_type !== ''
					? queryParams.resource_type.split(',').filter((type) => type !== common.RESOURCE_TYPE_PROGRAM)
					: ''

			//resource_type are not passing then return all rollout expect resource_type program
			filters.resource_type = resourceTypes.length
				? { [Op.in]: resourceTypes }
				: { [Op.not]: common.RESOURCE_TYPE_PROGRAM }

			// Remove the resources under a program (parent_id in rollout ID of the program type)
			if (programRolloutIds.length) {
				filters.parent_id = { [Op.notIn]: programRolloutIds }
			}

			if (queryParams.status && queryParams.status != '') {
				filters.status = {
					[Op.in]: queryParams.status.trim().split(','),
				}
			}

			const sort = await this.constructSortOptions(queryParams?.sort_by, queryParams?.sort_order)

			const rolloutList = await rolloutQueries.findAllAndCount(
				filters,
				[
					'id',
					'type',
					'resource_type',
					'resource_id',
					'title',
					'status',
					'start_date',
					'end_date',
					'organization_code',
					'created_by',
					'created_at',
					'updated_at',
				],
				{
					limit,
					offset: common.getPaginationOffset(page, limit),
					order: [sort],
				}
			)

			if (rolloutList.result.length <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ROLLOUT_LISTED_SUCCESSFULLY',
					result,
				})
			}

			let orgList = []

			rolloutList.result.forEach((eachRollout) => {
				orgList.push(eachRollout.organization_code)
			})

			// fetch the user details from user service
			const userDetails = await this.fetchUserDetails([loggedInUserId], organization_code, tenant_code, userToken)

			// fetch the org details from user service
			const orgDetails = await orgExtensionService.fetchOrganizationDetails(orgList, tenant_code)

			let rolloutFinalList = []

			rolloutList.result.forEach((eachRollout) => {
				eachRollout['creator'] = userDetails[eachRollout.created_by]
					? userDetails[eachRollout.created_by].name
					: null
				eachRollout['organization'] = orgDetails[eachRollout.organization_code]
					? orgDetails[eachRollout.organization_code]
					: null
				delete eachRollout['created_by']
				delete eachRollout['organization_code']
				rolloutFinalList.push(eachRollout)
			})

			result = {
				data: rolloutFinalList,
				count: rolloutList.count,
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ROLLOUT_LISTED_SUCCESSFULLY',
				result,
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
	 * Rollout update
	 * @method
	 * @name update
	 * @param {Integer} rolloutId - Rollout Id.
	 * @param {Object} bodyData - request data.
	 * @param {String} loggedInUserId - userId
	 * @param {String} org_code - organization id
	 * @param {String} tenant_code - tenant code
	 * @returns {JSON} - rollout update response.
	 */

	static async update(rolloutId, bodyData, loggedInUserId, org_code, tenant_code) {
		try {
			let rollout = await rolloutQueries.findOne({
				id: rolloutId,
				organization_code: org_code,
				tenant_code: tenant_code,
			})

			if (!rollout?.id) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (rollout.user_id !== loggedInUserId) {
				return responses.failureResponse({
					message: 'DONT_HAVE_ROLLOUT_ACCESS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Prevent changes to the resource id if a rollout is published
			if (bodyData.resource_id && bodyData.resource_id != rollout.resource_id) {
				if (rollout.rollout_date || bodyData.published_id) {
					return responses.failureResponse({
						message: 'CANT_CHANGE_RESOURCE',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				let resource = await resourceQueries.findOne({
					id: bodyData.resource_id,
					organization_code: org_code,
					stage: common.RESOURCE_STAGE_COMPLETION,
					tenant_code: tenant_code,
				})

				if (!resource?.id) {
					return responses.failureResponse({
						message: 'RESOURCE_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
			}

			bodyData = _.omit(bodyData, ['id', 'resource_type', 'type', 'organization_code', 'user_id', 'status'])

			if (bodyData.start_date == '' || bodyData.start_date == undefined) {
				bodyData.start_date = null
			}

			if (bodyData.end_date == '' || bodyData.end_date == undefined) {
				bodyData.end_date = null
			}

			const rolloutUploadStatus = await resourceService.uploadToCloud(
				common.ROLLOUT_UPLOAD_FILE_NAME,
				org_code,
				tenant_code,
				rolloutId,
				common.ROLL_OUT,
				loggedInUserId,
				bodyData
			)
			if (
				rolloutUploadStatus.result.status == httpStatusCode.ok ||
				rolloutUploadStatus.result.status == httpStatusCode.created
			) {
				bodyData.blob_path = rolloutUploadStatus.blob_path
			} else {
				throw new Error('FILE_UPLOADED_FAILED')
			}

			let filter = {
				id: rolloutId,
				organization_code: org_code,
				tenant_code: tenant_code,
			}

			let updateData = {
				updated_by: loggedInUserId,
				...bodyData,
			}

			const [updateCount, updatedRolledout] = await rolloutQueries.updateOne(filter, updateData, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ROLLOUT_SAVED_SUCCESSFULLY',
				result: updatedRolledout[0].id,
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
	 * Get all details of users from the user service.
	 * @name fetchUserDetails
	 * @param {Array} userIds - array of userIds.
	 * @param {String} userToken - user token of loggedin user.
	 * @param {String} org_code - organization id
	 * @param {String} tenant_code - tenant code
	 * @returns {Object} - Response contain object of user details
	 */
	static async fetchUserDetails(userIds, org_code, tenant_code, userToken = '') {
		const userDetailsResponse = await userRequests.list(
			common.FILTER_ALL.toLowerCase(), //type
			'', // page number
			'', // page size
			'', // search text
			org_code, // organization_code
			tenant_code, // tenant_code
			{
				user_ids: userIds,
			}, // body
			userToken
		)
		let userDetails = {}
		if (userDetailsResponse.success && userDetailsResponse.data?.result?.data?.length > 0) {
			userDetails = _.keyBy(userDetailsResponse.data.result.data, 'id')
		}
		return userDetails
	}

	/**
	 * Generate sort filter
	 * @name constructSortOptions
	 * @param {Object} sort_by - Sort by value
	 * @param sort_order - sort_order value ASC / DESC
	 * @returns {JSON} - Response contain sort filter
	 */
	static async constructSortOptions(sort_by, sort_order) {
		let sort = []
		if (sort_by && sort_order) {
			sort.push(sort_by)
			sort.push(sort_order.toUpperCase() == common.SORT_DESC.toUpperCase() ? common.SORT_DESC : common.SORT_ASC)
		} else {
			sort.push(common.CREATED_AT)
			sort.push(common.SORT_DESC)
		}
		return sort
	}

	/**
	 * rollout delete
	 * @method
	 * @name delete
	 * @param {Integer} rolloutId - rollout id
	 * @param {String} loggedInUserId - user id
	 * @returns {JSON} - rollout delete response.
	 */

	static async delete(rolloutId, loggedInUserId, tenantCode) {
		try {
			let rollout = await rolloutQueries.findOne({
				id: rolloutId,
				tenant_code: tenantCode,
				user_id: loggedInUserId,
				status: common.ROLLOUT_STATUS_PENDING,
			})

			if (!rollout?.id) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let updatedRolledout = await rolloutQueries.deleteOne(
				rolloutId,
				rollout.organization_code,
				rollout.tenant_code
			)

			if (updatedRolledout === 0) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ROLLOUT_DELETED_SUCCESSFULLY',
				result: {},
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
	 * rollout publish
	 * @method
	 * @name publish
	 * @param {Integer} rolloutId - Rollout Id.
	 * @param {String} loggedInUserId - userId
	 * @param {String} org_code - organization id
	 * @param {String} tenant_code -tenant_code
	 * @param {Integer} userToken - user token for consumption side creations.
	 * @returns {JSON} - rollout publish response.
	 */

	static async publish(rolloutId, loggedInUserId, org_code, tenant_code, userToken = '') {
		try {
			// fetch rollout details
			const rolloutDetails = await this.details(
				rolloutId,
				loggedInUserId,
				org_code,
				tenant_code,
				false,
				true,
				userToken
			)

			let solutionRolloutId
			let rolloutDetailsResult = rolloutDetails?.result

			// check if rollout is present or not
			if (rolloutDetails?.statusCode != httpStatusCode.ok) return rolloutDetails

			const validateRollout = await this.validateRollout(rolloutDetailsResult)
			if (validateRollout.length > 0) {
				const result = Array.isArray(validateRollout) ? validateRollout.flat() : validateRollout || []
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					result: result,
					message: 'ROLLOUT_VALIDATION_FAILED',
				})
			}

			if (!rolloutDetailsResult?.resource_details?.id) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					message: 'RESOURCE_NOT_FOUND',
				})
			}
			const validateTargeting = await targetingHelper.validateTargetingCriteria(
				rolloutDetails.result[common.TARGETING],
				org_code,
				tenant_code
			)
			if (!validateTargeting.success && validateTargeting?.errors?.length > 0) {
				const result = Array.isArray(validateTargeting?.errors)
					? validateTargeting?.errors.flat()
					: validateTargeting?.errors || []
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					result,
					message: 'ROLLOUT_VALIDATION_FAILED',
				})
			}

			// fetch resource details
			const resourceDetails = await resourceService.getDetails(
				rolloutDetailsResult?.resource_details,
				org_code,
				tenant_code
			)

			// if resource status is in the forbidden list , cannot proceed to rollout
			if (_forbidenStatusForResourcePublish.includes(resourceDetails?.result?.status)) {
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					result: {},
					message: 'FORBIDEN_RESOURCE_STATUS_FOR_ROLLOUT',
				})
			}

			let resourceDetailsResult = resourceDetails?.result
			resourceDetailsResult.resource_id = resourceDetailsResult?.id

			// check if resource is present or not
			if (resourceDetails?.statusCode != httpStatusCode.ok) return resourceDetails
console.log(resourceDetailsResult.type."resourceDetailsResult type************************")
			if (resourceDetailsResult.type != common.RESOURCE_TYPE_PROGRAM) {
				let solutionRollout = await rolloutQueries.findOne({
					resource_id: resourceDetailsResult?.id,
					type: common.ROLLOUT_TYPE_SOLUTION,
					parent_id: rolloutId,
					organization_code: org_code,
					tenant_code: tenant_code,
				})
console.log(solutionRollout,"solutionRollout&*************************")
				if (!solutionRollout?.id) {
					let solutionRollout = _.omit(rolloutDetailsResult, ['id', 'blob_path', 'created_at', 'updated_at'])
					solutionRollout.type = common.ROLLOUT_TYPE_SOLUTION
					solutionRollout.parent_id = rolloutId
					const resultCreateRollout = await this.create(
						solutionRollout,
						loggedInUserId,
						org_code,
						tenant_code,
						true
					)
					console.log(resultCreateRollout,"resultCreateRollout************************************")
					if (resultCreateRollout.statusCode !== httpStatusCode.ok) {
						return responses.failureResponse({
							statusCode: httpStatusCode[resultCreateRollout.statusCode],
							result: {},
							message: `Rollout creation failed: ${resultCreateRollout.message || 'Unknown error'}`,
						})
					}
					solutionRolloutId = resultCreateRollout?.result?.id
				} else {
					let solutionRollout = _.pick(rolloutDetailsResult, [
						'start_date',
						'end_date',
						'targerting_criteria',
					])
					// update the start date and end date of program for single roll out
					solutionRolloutId = rolloutDetailsResult.id
					await rolloutQueries.updateOne({ id: solutionRolloutId, tenant_code: tenant_code }, solutionRollout)
				}
			}

			// set the status of rollout to PROCESSING till it is published in the CONSUMPTION_SERVICE
			const updateBody = {
				status: common.ROLLOUT_STATUS_PROCESSING,
			}

			let updateResult = await rolloutQueries.updateOne({ id: rolloutId, tenant_code, organization_code: org_code }, updateBody)
console.log(updateResult,"updateResult rolloutQueries*********************************")
			const rolloutKafkaPayload = {
				id: rolloutDetails.result.id,
				tenant_code,
				organization_code: org_code,
				type: common.ROLL_OUT,
				userToken,
				userId: rolloutDetailsResult.user_id,
			}

			if (process.env.CONSUMPTION_SERVICE != common.SELF) {
				await kafkaCommunication.pushRolloutToKafka(rolloutKafkaPayload, common.ROLL_OUT)
			} else {
				// implement API based publish
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ROLLOUT_PUBLISHED',
				result: {},
			})
		} catch (error) {
			console.log(error,"error publish service************************"
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Validate rollout before publish
	 * @method
	 * @name validateRollout
	 * @param {Object} rollout - rollout object
	 * @returns {Array} - Array of errors if any , else an empty array
	 */
	static async validateRollout(rollout) {
		let validationErrors = []

		//get all entity type validations for rollout
		const rolloutEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
			{
				model: common.ROLL_OUT_MODEL,
				status: common.STATUS_ACTIVE,
			},
			rollout.organization_code,
			['value', 'validations']
		)

		let basePath = ''

		rolloutEntityTypes.forEach((entityType) => {
			let requiredValidation = entityType.validations.find(
				(validation) => validation.type == common.REQUIRED_VALIDATION
			)
			if (requiredValidation) {
				const required = utils.checkRequired(requiredValidation, rollout[entityType.value])
				if (!required) {
					validationErrors.push(
						utils.errorObject(basePath, entityType.value, `Rollout ${entityType.value} is required`)
					)
				}
			}

			//length check validation
			let maxLengthValidation = entityType.validations.find(
				(validation) => validation.type == common.MAX_LENGTH_VALIDATION
			)

			if (
				maxLengthValidation &&
				typeof rollout[entityType.value] === common.STRING &&
				rollout[entityType.value] !== null
			) {
				let lengthCheck = utils.checkLength(maxLengthValidation, rollout[entityType.value])

				if (!lengthCheck) {
					validationErrors.push(
						utils.errorObject(
							basePath,
							entityType.value,
							`${rolloutEntityTypes.value} must not exceed ${maxLengthValidation.value} characters `
						)
					)
				}
			}
			// Check regex pattern will check max length and special characters
			let regexValidation = entityType.validations.find(
				(validation) => validation.type == common.REGEX_VALIDATION
			)
			if (
				regexValidation &&
				typeof rollout[entityType.value] === common.STRING &&
				rollout[entityType.value] !== null
			) {
				const validateRegex = utils.checkRegexPattern(regexValidation, rollout[entityType.value])
				if (!validateRegex) {
					validationErrors.push(
						utils.errorObject(
							basePath,
							entityType.value,
							`Rollout ${entityType.value} can only include alphanumeric characters with spaces, -, _, &, ', <>`
						)
					)
				}
			}
			// Check regex pattern will check max length and special characters
			let endDateCheck = entityType.validations.find(
				(validation) => validation.type == common.END_DATE_VALIDATION
			)
			if (
				endDateCheck &&
				typeof rollout[entityType.value] === common.STRING &&
				rollout[entityType.value] !== null
			) {
				const validateEndDate = utils.checkEndDate(rollout[common.START_DATE], rollout[entityType.value])
				if (!validateEndDate) {
					validationErrors.push(
						utils.errorObject(
							basePath,
							entityType.value,
							validateEndDate.message || 'End date should be greater than the start date.'
						)
					)
				}
				const now = new Date()
				if (rollout[entityType.value] < now) {
					validationErrors.push(
						utils.errorObject(basePath, common.END_DATE, `End date cannot be less than current date.`)
					)
				}
			}
		})

		return validationErrors
	}

	/**
	 * Callback URL for Update Published Rollout
	 * @method
	 * @name publishCallback
	 * @param {String} rolloutId - rollout id
	 * @param {String} publishedId - published id
	 * @param {String} templateId - template id
	 * @returns {JSON} - details of Rollout
	 */
	static async publishCallback(
		rolloutId,
		publishedId = null,
		templateId = null,
		tenantCode,
		isProgramResource = false
	) {
		try {
			let updateData = {
				published_on: new Date(),
				status: common.ROLLOUT_STATUS_PUBLISHED,
			}
			if (publishedId) updateData.published_id = publishedId
			if (templateId) updateData.template_id = templateId
			let rollout = await rolloutQueries.updateOne(
				{
					id: rolloutId,
					tenant_code: tenantCode,
				},
				updateData
			)

			if (rollout === 0) {
				return responses.failureResponse({
					message: 'ROLLOUT_PUBLISH_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ROLLOUT_UPDATED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Update program rollout
	 * @method
	 * @name updateProgramRollout
	 * @param {Integer} programId - program Id
	 * @param {Object} programData - Program data object
	 * @param {String} userId - The ID of the user
	 * @param {String} org_code - The ID of the Organization
	 * @param {String} tenant_code - tenant code
	 * @param {String} userToken -user token
	 * @returns {Integer} - program rollout id
	 */
	static async updateProgramRollout(programId, programData, userId, org_code, tenant_code, userToken = false) {
		try {
			// fetch the resource ids from the program
			const programResourceIds = programData.resources.map((resource) => resource.id)

			// fetch rollout data of program and resources
			let fetchRollouts = await rolloutQueries.findAll(
				{
					resource_id: {
						[Op.in]: [programId, ...programResourceIds],
					},
					user_id: userId,
					organization_code: org_code,
					tenant_code: tenant_code,
				},
				{
					attributes: ['id', 'resource_type', 'resource_id'],
				}
			)

			const createdRolloutResources = fetchRollouts.map((rollout) => rollout.resource_id)

			const deltaResources = _.difference(programResourceIds, createdRolloutResources)

			if (deltaResources.length > 0) {
				let createRolloutPromise = []
				const programResources = programData?.resources || []
				for (const resource of deltaResources) {
					const fetchResourceDetails = await resourceService.getDetails(
						resource,
						programData.organization_code,
						tenant_code,
						userToken
					)
					const rolloutDetails = _.omit(fetchResourceDetails?.result, [
						'resource_id',
						'resource_type',
						'start_date',
						'end_date',
						'targeting_criteria',
						'title',
						'blob_path',
					])
					const findResources = programResources.find((programResource) => programResource.id == resource)
					const resourceRolloutReqBody = {
						resource_id: resource,
						resource_type: fetchResourceDetails.result?.type,
						start_date: findResources?.start_date || '',
						end_date: findResources?.end_date || '',
						targeting_criteria: findResources?.targeting_criteria,
						title: findResources.title,
						userToken,
						...rolloutDetails,
					}

					createRolloutPromise.push(
						this.create(resourceRolloutReqBody, userId, programData.organization_code, tenant_code, true)
					)
				}
				await Promise.all(createRolloutPromise)
				fetchRollouts = await rolloutQueries.findAll(
					{
						resource_id: {
							[Op.in]: [programId, ...programResourceIds],
						},
						user_id: userId,
						organization_code: org_code,
						tenant_code: tenant_code,
					},
					{
						attributes: ['id', 'resource_type', 'resource_id'],
					}
				)
			}

			let resourceRolloutResourceIdMap = {} // initialise rollout id resource mapping
			let programRolloutId // initialise variable for program rollout id

			// seggregate program rollout id and create rollout id resource mapping
			fetchRollouts.forEach((rollout) => {
				if (rollout.type != common.RESOURCE_TYPE_PROGRAM) {
					resourceRolloutResourceIdMap[rollout.resource_id] = rollout.id
				} else if (rollout.type == common.RESOURCE_TYPE_PROGRAM && rollout.resource_id == programId) {
					programRolloutId = rollout.id
				}
			})
			const viewers = programData.viewers.map((viewer) => viewer?.id || viewer)
			// update rollout variable
			let rolloutUpdate = {
				start_date: programData?.meta?.start_date || '',
				end_date: programData?.meta?.end_date || '',
				targeting_criteria: programData?.targeting_criteria || [],
				updated_at: new Date(),
				viewers,
				userToken,
				resources: [],
			}
			// prepare resources for program rollout update
			programData.resources.forEach((resource) => {
				rolloutUpdate.resources.push(resource)
			})
			// create a promise variable and add program rollout update
			let rolloutUpdatePromise = [this.update(programRolloutId, rolloutUpdate, userId, org_code, tenant_code)]

			// append resource rollout update promises
			rolloutUpdate.resources.forEach(async (resource) => {
				rolloutUpdatePromise.push(
					this.update(
						resourceRolloutResourceIdMap[resource.id],
						{ ...resource, viewers },
						userId,
						org_code,
						tenant_code
					)
				)
			})

			// execute all the promises
			await Promise.all(rolloutUpdatePromise)

			const rolloutDetails = await this.details(
				programRolloutId,
				programData.user_id,
				programData.organization_code,
				tenant_code,
				false,
				false,
				userToken
			)

			const validateRollout = await this.validateRollout(rolloutDetails.result)
			if (validateRollout.length > 0) {
				const result = Array.isArray(validateRollout) ? validateRollout.flat() : validateRollout || []
				return responses.failureResponse({
					statusCode: httpStatusCode.bad_request,
					result: result,
					message: 'ROLLOUT_VALIDATION_FAILED',
				})
			}

			return programRolloutId
		} catch (error) {
			throw new Error('Program Rollout Update failed. Error : ', error)
		}
	}

	/**
	 * Create Program Rollout
	 * @method
	 * @name createProgramRollout
	 * @param {Object} programData - Program data object
	 * @param {String} userId - User id
	 * @param {String} userToken -userToken
	 * @returns {Integer} - program rollout id
	 */

	static async createProgramRollout(programData, userId, userToken = '') {
		try {
			let createRolloutPromise = []
			let resourceIds = [programData?.id]
			const programResourceIds = programData?.resources.map((programResource) => programResource.id)
			// check if the resource rollout is already created by the user
			const solutionRollouts = await rolloutQueries.findAll(
				{
					resource_id: {
						[Op.in]: programResourceIds,
					},
					organization_code: programData.organization_code,
					created_by: userId,
					tenant_code: programData.tenant_code,
				},
				['id']
			)
			let solutionRolloutsIds = []
			if (solutionRollouts.length > 0) {
				solutionRolloutsIds = solutionRollouts.map((solution) => solution.id)
			}

			for (const resource of programData?.resources || []) {
				if (!solutionRolloutsIds.includes(resource?.id)) {
					resourceIds.push(resource?.id)
					const fetchResourceDetails = await resourceService.getDetails(
						resource?.id,
						programData.organization_code,
						programData.tenant_code,
						userToken
					)
					const rolloutDetails = _.omit(fetchResourceDetails?.result, [
						'resource_id',
						'resource_type',
						'start_date',
						'end_date',
						'targeting_criteria',
						'title',
						'id',
						'status',
						'review_type',
						'stage',
						'is_under_edit',
						'is_reusable',
						'next_stage',
						'submitted_on',
					])
					const resourceRolloutReqBody = {
						resource_id: resource?.id,
						resource_type: fetchResourceDetails.result?.type,
						start_date: resource?.start_date || '',
						end_date: resource?.end_date || '',
						targeting_criteria: resource?.targeting_criteria,
						title: resource.title,
						userToken,
						...rolloutDetails,
					}

					createRolloutPromise.push(
						this.create(
							resourceRolloutReqBody,
							userId,
							programData.organization_code,
							programData.tenant_code,
							true
						)
					)
				}
			}

			const updateResourceFilter = {
				id: {
					[Op.in]: resourceIds,
				},
				tenant_code: programData.tenant_code,
			}
			const updateResourceBody = {
				status: common.RESOURCE_STATUS_PUBLISHED,
				stage: common.RESOURCE_STAGE_COMPLETION,
				published_on: new Date(),
			}

			await resourceQueries.updateOne(updateResourceFilter, updateResourceBody)

			// rollout request body
			const rolloutReqBody = {
				resource_id: programData?.id,
				resource_type: programData?.type,
				start_date: programData?.meta?.start_date,
				end_date: programData?.meta?.end_date,
				resources: programData?.resources || [],
				targeting_criteria: programData?.targeting_criteria,
				title: programData.title,
				userToken,
				viewers: programData?.viewers?.map((viewer) => (typeof viewer === 'object' ? viewer.id : viewer)),
			}
			// create an entry to rollout table
			const createProgramRollout = await this.create(
				rolloutReqBody,
				programData.user_id,
				programData.organization_code,
				programData.tenant_code,
				false
			)

			if (createProgramRollout.statusCode !== httpStatusCode.ok) {
				return responses.failureResponse({
					statusCode: httpStatusCode[createProgramRollout.statusCode],
					result: [],
					message: `Rollout creation failed: ${createProgramRollout.message || 'Unknown error'}`,
				})
			}

			const solutionRollout = await Promise.all(createRolloutPromise)

			const solutionRolloutIds = solutionRollout
				.filter((solution) => solution.statusCode === 200)
				.map((solution) => solution.result.id)
			// update program rollout id as parent_id in solution rollouts
			await rolloutQueries.updateOne(
				{
					id: {
						[Op.in]: solutionRolloutIds,
					},
					tenant_code: programData.tenant_code,
				},
				{
					parent_id: createProgramRollout?.result?.id,
				}
			)

			return {
				success: true,
				rolloutId: createProgramRollout?.result?.id,
			}
		} catch (error) {
			return {
				success: false,
				error: `Program Rollout Creation failed. Error : ${error}`,
			}
		}
	}
}

const _forbidenStatusForResourcePublish = [
	common.RESOURCE_STATUS_DRAFT,
	common.RESOURCE_STATUS_STARTED,
	common.RESOURCE_STATUS_REJECTED,
	common.RESOURCE_STATUS_IN_REVIEW,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
]

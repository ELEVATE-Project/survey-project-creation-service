/* eslint-disable no-useless-catch */
const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const resourceCreatorMappingQueries = require('@database/queries/resourcesCreatorMapping')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const orgExtensionService = require('@services/organization-extension')
const _ = require('lodash')
const { Op } = require('sequelize')
const resourceService = require('@services/resource')
const programResourceMappingQueries = require('@database/queries/programResourceMapping')
const reviewsQueries = require('@database/queries/reviews')
const filesService = require('@services/files')
const userRequests = require('@requests/user')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const utils = require('@generics/utils')
const commentQueries = require('@database/queries/comments')
const projectService = require('@services/projects')
const reviewsResourcesQueries = require('@database/queries/reviewsResources')
const reviewService = require('@services/reviews')
const rolloutService = require('@services/rollouts')
module.exports = class ProgramsHelper {
	/**
	 * Program create
	 * @method
	 * @name create
	 * @param {Object} bodyData - Request body data.
	 * @param {string} loggedInUserId - The ID of the logged-in user.
	 * @param {string} orgId - The ID of the organization.
	 * @param {Integer} referenceId - The ID of program need to copy
	 * @returns {JSON} - Program ID or error response.
	 */
	static async create(bodyData, loggedInUserId, orgId, tenantCode, referenceId = null, userToken = '') {
		try {
			let programData = {}
			let isDuplicateProgramCreation = false
			if (referenceId) {
				// check if the reference project Id is valid or not
				const referenceProgram = await resourceQueries.findOne(
					{
						id: referenceId,
						tenant_code: tenantCode,
						status: common.RESOURCE_STATUS_PUBLISHED,
						stage: common.RESOURCE_STAGE_COMPLETION,
						type: common.RESOURCE_TYPE_PROGRAM,
					},
					{
						attributes: {
							exclude: [
								'stage',
								'status',
								'user_id',
								'next_stage',
								'review_type',
								'reference_id',
								'published_id',
								'created_by',
								'created_at',
								'updated_at',
								'updated_by',
								'submitted_on',
								'published_on',
								'last_reviewed_on',
								'is_under_edit',
								'is_reusable',
							],
						},
					}
				)

				if (!referenceProgram?.id || !referenceProgram.is_reusable) {
					return responses.failureResponse({
						message: 'PROGRAM_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				const programDetails = await this.details(
					referenceId,
					referenceProgram.organization_code,
					referenceProgram.tenant_code,
					userToken
				)
				if (programDetails.statusCode != httpStatusCode.ok && !Object.keys(programDetails?.result).length > 0) {
					return responses.failureResponse({
						message: 'PROGRAM_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				bodyData.start_date = programDetails.result?.start_date || ''
				bodyData.end_date = programDetails.result?.end_date || ''
				bodyData.viewers = []
				bodyData.resources = []
				isDuplicateProgramCreation = true

				programData = {
					..._.omit(programDetails.result, [
						'id',
						'organization_code',
						'organization',
						'stage',
						'status',
						'user_id',
						'next_stage',
						'review_type',
						'reference_id',
						'published_id',
						'created_by',
						'created_at',
						'updated_at',
						'updated_by',
						'submitted_on',
						'published_on',
						'last_reviewed_on',
						'is_under_edit',
					]),
					reference_id: referenceId,
				}
				bodyData.resources = programDetails.result.resources
			}

			// Get the review type of the organization
			const orgConfig = await orgExtensionService.getConfig(orgId, tenantCode)
			const orgConfigList = _.reduce(
				orgConfig.result.resource,
				(acc, item) => {
					acc[item.resource_type] = item.review_type
					return acc
				},
				{}
			)

			// Construct the program data
			programData = {
				...programData,
				title: bodyData.title,
				type: common.RESOURCE_TYPE_PROGRAM,
				status: common.RESOURCE_STATUS_DRAFT,
				stage: common.RESOURCE_STAGE_CREATION,
				user_id: loggedInUserId,
				review_type: orgConfigList[common.RESOURCE_TYPE_PROGRAM],
				organization_code: orgId,
				tenant_code: tenantCode,
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
				link: null,
				meta: {
					start_date: bodyData.start_date || '',
					end_date: bodyData.end_date || '',
				},
			}

			// Create program and handle resource mapping
			let programCreate = await resourceQueries.create(programData)
			const programId = programCreate?.id

			const mappingData = {
				resource_id: programId,
				creator_id: loggedInUserId,
				organization_code: orgId,
				tenant_code: tenantCode,
			}
			await resourceCreatorMappingQueries.create(mappingData)

			// Handle resources if present in the request
			if (bodyData?.resources?.length > 0) {
				await handleResources(
					bodyData.resources,
					programId,
					orgId,
					tenantCode,
					loggedInUserId,
					isDuplicateProgramCreation,
					userToken
				)
			}

			try {
				// Upload program to cloud
				if (programId) {
					await resourceService.uploadAndUpdateResource(
						programId,
						orgId,
						tenantCode,
						loggedInUserId,
						bodyData,
						common.PROGRAM_UPLOAD_FILE_NAME,
						common.RESOURCE_TYPE_PROGRAM
					)
				}
			} catch (error) {
				return responses.failureResponse({
					message: error.message || error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROGRAM_CREATED_SUCCESSFULLY',
				result: { id: programId },
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Program update
	 * @method
	 * @name update
	 * @param {Object} bodyData - Request body data.
	 * @param {string} loggedInUserId - The ID of the logged-in user.
	 * @param {string} orgCode - The ID of the organization.
	 * @param {string} is_under_edit_param - Frontend Paramenter to update the is_under_edit key.
	 * @returns {JSON} - Program ID or error response.
	 */
	static async update(
		resourceId,
		bodyData,
		loggedInUserId,
		orgCode,
		tenantCode,
		is_under_edit_param = false,
		userToken = ''
	) {
		try {
			const forbidden_resource_statuses = [
				common.RESOURCE_STATUS_REJECTED,
				common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
				common.RESOURCE_STATUS_SUBMITTED,
				common.REVIEW_STATUS_INPROGRESS,
			]
			// Fetch the program to be updated
			const fetchResource = await resourceQueries.findOne({
				id: resourceId,
				organization_code: orgCode,
				tenant_code: tenantCode,
				status: {
					[Op.notIn]: forbidden_resource_statuses,
				},
			})

			let programId = fetchResource?.id
			if (!programId) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Check if the program is in the review stage and has no requested changes
			const countReviews = await reviewsQueries.distinctResources(
				{
					organization_code: orgCode,
					tenant_code: tenantCode,
					resource_id: resourceId,
					status: [common.REVIEW_STATUS_REQUESTED_FOR_CHANGES],
				},
				['resource_id']
			)

			if (fetchResource.stage === common.RESOURCE_STAGE_REVIEW && countReviews.count == 0) {
				return responses.failureResponse({
					message: {
						key: 'FORBIDDEN_RESOURCE_UPDATE',
						interpolation: { resourceTitle: fetchResource.title, reviewer_count: countReviews },
					},
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Omit fields that should not be updated
			bodyData = _.omit(bodyData, [
				'review_type',
				'type',
				'organization_code',
				'user_id',
				'is_resuable',
				'stage',
				'status',
			])

			// Fetch existing resource mappings for the program
			const existingMappings = await programResourceMappingQueries.findAll({
				program_id: programId,
				tenant_code: tenantCode,
				organization_code: fetchResource.organization_code,
			})

			const existingResourceIds = existingMappings.map((mapping) => mapping.resource_id)
			const updatedResourceIds = bodyData.resources?.map((res) => res.id) || []

			//update the existing resource
			const existingResourcesToUpdate =
				bodyData.resources?.filter(
					(res) => existingResourceIds.includes(res.id) && updatedResourceIds.includes(res.id)
				) || []

			if (existingResourcesToUpdate.length > 0) {
				await handleResources(
					existingResourcesToUpdate,
					resourceId,
					orgCode,
					tenantCode,
					loggedInUserId,
					false,
					userToken
				)
			}

			// Delete removed resources from programResourceMapping
			const resourcesToRemove = existingResourceIds.filter((id) => !updatedResourceIds.includes(id))
			if (resourcesToRemove.length > 0) {
				await programResourceMappingQueries.deleteMany(resourceId, resourcesToRemove, tenantCode)
			}

			// Identify new resources to be added
			const newResources = bodyData.resources?.filter((res) => !existingResourceIds.includes(res.id)) || []
			// Handle new resources (create duplicates, upload to cloud, and map to program)
			if (newResources.length > 0) {
				await handleResources(newResources, resourceId, orgCode, tenantCode, loggedInUserId, false, userToken)
			}

			//Upload program information to cloud
			await resourceService.uploadAndUpdateResource(
				programId,
				orgCode,
				tenantCode,
				loggedInUserId,
				bodyData,
				common.PROGRAM_UPLOAD_FILE_NAME,
				common.RESOURCE_TYPE_PROGRAM
			)

			// Update the program details
			const updateData = {
				...bodyData,
				updated_by: loggedInUserId,
				meta: {
					...fetchResource.meta,
					start_date: bodyData.start_date || '',
					end_date: bodyData.end_date || '',
				},
			}

			//update is_under_edit true if reviewer requested for changes
			if (countReviews.count > 0 || is_under_edit_param) {
				updateData.is_under_edit = true
			}

			const [updateCount, updatedProgram] = await resourceQueries.updateOne(
				{ id: resourceId, organization_code: orgCode, tenant_code: tenantCode },
				updateData,
				{ returning: true, raw: true }
			)

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: [common.RESOURCE_STAGE_REVIEW, common.RESOURCE_STAGE_COMPLETION].includes(fetchResource.stage)
					? 'PROGRAM_SAVED_SUCCESSFULLY'
					: 'PROGRAM_UPDATED_SUCCESSFUL',
				result: updatedProgram[0].id,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Program details
	 * @method
	 * @name details
	 * @param {String} programId - Program id
	 * @param {String} orgId - Organization id
	 * @param {String} loggedInUserId - User id
	 * @returns {JSON} - Program Details
	 */
	static async details(programId, orgCode, tenantCode, userToken = '') {
		try {
			// Fetch the program details
			const program = await resourceQueries.findOne({
				id: programId,
				tenant_code: tenantCode,
				type: common.RESOURCE_TYPE_PROGRAM,
			})

			if (!program?.id) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Initialize the result object
			let result = {
				...program,
				organization: {},
				viewers: [],
			}

			// Fetch the data from storage if blob_path exists
			if (program.blob_path) {
				const response = await filesService.fetchJsonFromCloud(program.blob_path)

				if (
					response.statusCode === httpStatusCode.ok &&
					response.result &&
					Object.keys(response.result).length > 0
				) {
					Object.assign(result, response.result)
					result.resources = []

					let entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
						{
							model: common.ENTITY_TYPE_MODELS[program.type],
							status: common.STATUS_ACTIVE,
						},
						program.organization_code,
						tenantCode,
						['id', 'value', 'label', 'has_entities']
					)

					if (entityTypes.length > 0) {
						//create label value pair map
						const entityTypeMap = entityTypes.reduce((map, type) => {
							if (type.has_entities && Array.isArray(type.entities) && type.entities.length > 0) {
								map[type.value] = type.entities
									.filter((entity) => entity.status === common.STATUS_ACTIVE)
									.map((entity) => ({ label: entity.label, value: entity.value.toLowerCase() }))
							}
							return map
						}, {})

						await Promise.all(
							entityTypes.map(async (entityType) => {
								const key = entityType.value
								// Skip the entity type if entities are not available
								if (
									entityType.has_entities &&
									entityType.entities?.length > 0 &&
									result.hasOwnProperty(key) &&
									entityType.value != common.DURATION
								) {
									const value = result[key]
									// If the value is already in label-value pair format, skip processing
									if (utils.isLabelValuePair(value) || value === '') {
										return
									}

									// Get the entities
									const validEntities = entityTypeMap[key] || []

									if (Array.isArray(value)) {
										// Map each item in the array to a label-value pair, if it exists in validEntities
										result[key] = value.map((item) => {
											const match = validEntities.find(
												(entity) => entity.value === item.toLowerCase()
											)
											return match || { label: item, value: item.toLowerCase() }
										})
									} else {
										// If the value is a single item, find it in validEntities
										const match = validEntities.find(
											(entity) => entity.value === value.toLowerCase()
										)
										result[key] = match || { label: value, value: value.toLowerCase() }
									}
								}
							})
						)
					}
					// fetch the user if viewer is present
					if (response?.result?.viewers?.length > 0) {
						const userDetails = await this.fetchUserDetails(response.result.viewers, userToken)
						if (userDetails && Object.keys(userDetails).length > 0) {
							result.viewers = response.result.viewers.map((userId) => userDetails[userId])
						}
					}
				}
			}

			// Fetch organization details and associated resources
			const [organizationDetails, associatedResources] = await Promise.all([
				orgExtensionService.fetchOrganizationDetails([program.organization_code], tenantCode, userToken),
				programResourceMappingQueries.findAll({
					program_id: programId,
					organization_code: program.organization_code,
					tenant_code: tenantCode,
				}),
			])

			if (organizationDetails?.[program.organization_code]) {
				result.organization = _.pick(organizationDetails[program.organization_code], ['id', 'name', 'code'])
			}

			// Fetch resource details if associated resources exist
			if (associatedResources.length > 0) {
				const resourceIds = associatedResources.map((resource) => resource.resource_id)

				const [resources, openComments] = await Promise.all([
					resourceQueries.findAll({
						id: { [Op.in]: resourceIds },
						organization_code: program.organization_code,
						tenant_code: tenantCode,
					}),
					commentQueries.findAll({
						resource_id: { [Op.in]: resourceIds },
						status: common.COMMENT_STATUS_OPEN,
						tenant_code: tenantCode,
					}),
				])

				if (resources.length > 0) {
					const resourceCommentSet = new Set(openComments.map((comment) => comment.resource_id))
					// Process each resource and store in result.resources
					const resourceDetailsPromises = resources.map((resource) =>
						resourceService.getDetails(resource.id, resource.organization_code, tenantCode, userToken)
					)
					const resourceDetailsResults = await Promise.all(resourceDetailsPromises)
					result.resources = resourceDetailsResults
						.filter((resourceDetail) => resourceDetail.statusCode === httpStatusCode.ok)
						.map((resourceDetail) => ({
							...resourceDetail.result,
							link: resourceDetail?.result.link
								? `${process.env.PROJECT_DEEP_LINK_URL}${resourceDetail?.result?.link}`
								: null,
							is_comments: resourceCommentSet.has(resourceDetail.result.id),
						}))
				}
			}

			if (result?.meta) {
				Object.assign(result, result.meta)
			}
			delete result.blob_path

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROGRAM_FETCHED_SUCCESSFULLY',
				result: result,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get all details of users from the user service.
	 * @name fetchUserDetails
	 * @param {Array} userIds - array of userIds.
	 * @returns {Object} - Response contain object of user details
	 */
	static async fetchUserDetails(userIds, userToken = '') {
		const userDetailsResponse = await userRequests.list(
			common.FILTER_ALL.toLowerCase(),
			'',
			'',
			'',
			'',
			tenantCode,
			{
				user_ids: userIds,
			}
		)
		let userDetails = {}
		if (userDetailsResponse.success && userDetailsResponse.data?.result?.data?.length > 0) {
			userDetails = _.keyBy(userDetailsResponse.data.result.data, 'id')
		}
		return userDetails
	}
	/**
	 * add Resources to Program
	 * @method
	 * @name addResources
	 * @param {string} programId - resource id of the program to add resources
	 * @param {Object} bodyData - Request body data.
	 * @param {string} loggedInUserId - The ID of the logged-in user.
	 * @param {string} orgId - The ID of the organization.
	 * @returns {JSON} - Program ID or error response.
	 */
	static async addResources(programId, updateBody, loggedInUserId, orgId, tenantCode, userToken = '') {
		try {
			// Convert resource IDs to integers
			const resourceIds = updateBody.resource_ids.map(Number)

			// Fetch all resources in a single query
			const fetchProgramAndResources = await resourceQueries.findAll({
				id: { [Op.in]: [programId, ...resourceIds] },
			})

			// Early validation: Check if the program exists and belongs to the logged-in user
			const programDetails = fetchProgramAndResources.find(
				(resource) => resource.id === programId && resource.type === common.RESOURCE_TYPE_PROGRAM
			)

			if (!programDetails || programDetails.created_by !== loggedInUserId) {
				responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Check for missing resource IDs
			const fetchedResourceIds = new Set(fetchProgramAndResources.map((resource) => resource.id))
			const invalidResourceIds = resourceIds.filter((resourceId) => !fetchedResourceIds.has(resourceId))

			if (invalidResourceIds.length > 0) {
				return responses.failureResponse({
					message: `Invalid resource IDs provided ${invalidResourceIds.join(', ')}`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Segregate reusable and non-reusable resources
			const resourceToCreate = fetchProgramAndResources
				.filter((resource) => resource.id !== programId && resource.type !== common.RESOURCE_TYPE_PROGRAM)
				.map((resource) => {
					if (!resource.is_reusable) {
						responses.failureResponse({
							message: 'FORBIDDEN_RESOURCE_IN_PROGRAM',
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
						})
					}
					return resource
				})

			// Run tasks in parallel
			const [createdResources, fetchProgramDetails] = await Promise.all([
				// Create copies of reusable resources in parallel
				resourceToCreate.length > 0
					? handleResources(resourceToCreate, programId, orgId, tenantCode, loggedInUserId, false, userToken)
					: Promise.resolve([]),

				// Fetch program details in parallel
				resourceService.getDetails(programId, orgId, tenantCode, userToken),
			])

			// Prepare data for upload
			const programData = _.omit(fetchProgramDetails.result, [
				'created_at',
				'updated_at',
				'created_by',
				'updated_by',
				'status',
				'organization',
			])

			// Upload and update the program resource
			await resourceService.uploadAndUpdateResource(
				programId,
				orgId,
				tenantCode,
				loggedInUserId,
				programData,
				common.PROGRAM_UPLOAD_FILE_NAME,
				common.RESOURCE_TYPE_PROGRAM
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_ADDED_TO_PROGRAM',
				result: programId,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Remove resources from a program.
	 * @method
	 * @name removeResources
	 * @param {string} programId - The ID of the program from which resources will be removed.
	 * @param {Object} bodyData - Request body data containing resource IDs.
	 * @param {string} loggedInUserId - The ID of the logged-in user.
	 * @param {string} orgId - The ID of the organization.
	 * @returns {JSON} - Success response or error response.
	 */
	static async removeResources(programId, bodyData, loggedInUserId, orgId, tenantCode) {
		try {
			// Fetch program details
			const program = await resourceQueries.findOne(
				{ id: programId, organization_code: orgId, tenant_code: tenantCode },
				{
					attributes: ['id', 'status', 'published_id', 'published_on'],
				}
			)

			// Validate if the program exists
			if (!program?.id) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Check if the program is published
			if (program.status === common.PUBLISHED_STATUS || program.published_id || program.published_on) {
				// Fetch all resources linked to the program
				const mappedResources = await programResourceMappingQueries.findAll({
					program_id: programId,
					tenant_code: tenantCode,
				})

				if (!mappedResources.length) {
					return responses.failureResponse({
						message: 'NO_RESOURCES_FOUND_TO_REMOVE',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				// Create a map of existing resource IDs and their added timestamps
				const existingResourceMap = mappedResources.reduce((acc, resource) => {
					acc[resource.resource_id] = resource.created_at
					return acc
				}, {})

				// Validate resource existence
				const invalidResources = bodyData.resource_ids.filter((resourceId) => !existingResourceMap[resourceId])
				if (invalidResources.length > 0) {
					return responses.failureResponse({
						message: 'INVALID_RESOURCES_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				// If the program is published, only allow removing resources added after publishing
				const resourcesAddedBeforePublishing = bodyData.resource_ids.filter((resourceId) => {
					return existingResourceMap[resourceId] < program.published_on
				})

				if (resourcesAddedBeforePublishing.length > 0) {
					return responses.failureResponse({
						message: 'CANNOT_REMOVE_RESOURCES_ADDED_BEFORE_PUBLISHING',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
			}

			// Convert resource IDs to numbers
			const resourceIdsToRemove = bodyData.resource_ids.map(Number)

			// Remove resources
			const deletedCount = await programResourceMappingQueries.deleteMany(
				programId,
				resourceIdsToRemove,
				tenantCode
			)

			// Check if any resources were removed
			if (!deletedCount) {
				return responses.failureResponse({
					message: 'NO_RESOURCES_FOUND_TO_REMOVE',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCES_REMOVED_FROM_PROGRAM',
				result: programId,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Program delete
	 * @method
	 * @name delete
	 * @param {Integer} resourceId - Program id
	 * @param {String} loggedInUserId - User id
	 * @returns {JSON} - program delete response.
	 */

	static async delete(resourceId, loggedInUserId, tenantCode) {
		try {
			const resourceCreatorMapping = await resourceCreatorMappingQueries.findOne(
				{
					resource_id: resourceId,
					creator_id: loggedInUserId,
					tenant_code: tenantCode,
				},
				['id', 'organization_code']
			)

			if (!resourceCreatorMapping?.id) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
					type: common.RESOURCE_TYPE_PROGRAM,
					organization_code: resourceCreatorMapping.organization_code,
					tenant_code: tenantCode,
					status: common.RESOURCE_STATUS_DRAFT,
					stage: common.RESOURCE_STAGE_CREATION,
				},
				{ attributes: ['id', 'organization_code', 'published_id'] }
			)

			if (!resource?.id) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let updatedResource = await resourceQueries.deleteOne(
				resourceId,
				resource.organization_code,
				resource.tenant_code
			)
			let updatedResourceCreatorMapping = await resourceCreatorMappingQueries.deleteOne(
				resourceCreatorMapping.id,
				loggedInUserId,
				resource.organization_code,
				resource.tenant_code
			)

			if (updatedResource === 0 && updatedResourceCreatorMapping === 0) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'PROGRAM_DELETED_SUCCESSFUL',
				result: {},
			})
		} catch (error) {
			return error
		}
	}

	/* Get Program Managers list
	 * @method
	 * @name getProgramManagers
	 * @param orgId  - Organization Id
	 * @param pageNo - Page number
	 * @param pageSize - Page size
	 * @returns {JSON} - List of program managers
	 */
	static async getProgramManagers(orgId, tenantCode, pageNo, pageSize, userToken = '') {
		try {
			// get org config based on orgId
			const orgConfigs = await orgExtensionService.getConfig(orgId)
			const programManagerRoles = orgConfigs?.result?.config?.program_managers
			// fetch the users from user service
			const programManagersList = await userRequests.list(
				programManagerRoles.join(','),
				pageNo,
				pageSize,
				'',
				orgId,
				tenantCode,
				{},
				userToken
			)
			let result = {
				data: [],
				count: 0,
			}

			if (programManagersList.success && programManagersList?.data?.result?.data.length) {
				result = programManagersList?.data?.result
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROGRAM_MANAGER_LIST_FETCHED',
				result,
			})
		} catch (error) {
			throw error
		}
	}
	/**
	 * Submit the program for review
	 * @method
	 * @name submitForReview
	 * @param {string} programId - The ID of the program for submitting for review.
	 * @param {Object} bodyData - Request body data.
	 * @param {Object} userDetails - user details of the loggedIn user.
	 * @returns {JSON} - Response status of the submission
	 */
	static async submitForReview(programId, bodyData, userDetails) {
		try {
			let programDetails = await this.details(
				programId,
				userDetails.organization_code,
				userDetails.tenant_code,
				userDetails.token
			)
			if (programDetails.statusCode !== httpStatusCode.ok) {
				return responses.failureResponse({
					message: 'DONT_HAVE_PROGRAM_ACCESS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let programData = programDetails.result

			//check the creator is valid
			if (programData.user_id !== userDetails.id) {
				return responses.failureResponse({
					message: 'DONT_HAVE_PROGRAM_ACCESS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//Restrict the user to submit the program
			if (_nonReviewableResourceStatuses.includes(programData.status)) {
				throw new Error(`Program is already ${programData.status}. You cannot submit it`)
			}

			const resourceData = programData.resources
			const resourceIds = resourceData.map((resource) => resource.id)
			const resourceTypes = [...resourceData.map((resource) => resource.type), 'resource']

			// check any open comments are there for this program
			const comments = await commentQueries.findAndCountAll({
				user_id: {
					[Op.notIn]: [userDetails.id],
				},
				resource_id: {
					[Op.in]: [programId, ...resourceIds],
				},
				status: common.COMMENT_STATUS_OPEN,
				tenant_code: userDetails.tenant_code,
			})

			if (comments.count > 0) {
				return responses.failureResponse({
					message: 'ALL_COMMENTS_NOT_RESOLVED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Check that the note character limit does not exceed the maximum limit
			if (bodyData?.notes?.length > process.env.MAX_RESOURCE_NOTE_LENGTH) {
				return responses.failureResponse({
					message: 'RESOURCE_NOTE_LENGTH_EXCEEDED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//validate reviewers
			let reviewerIds = []
			if (bodyData.reviewer_ids && bodyData.reviewer_ids.length > 0) {
				reviewerIds = await validateReviewers(bodyData.reviewer_ids, userDetails)
			}

			const validationErrors = await this.handleProgramValidation(
				programData,
				resourceIds,
				resourceData,
				resourceTypes
			)

			if (validationErrors.length > 0) {
				const result = Array.isArray(validationErrors) ? validationErrors.flat() : validationErrors || []
				return responses.failureResponse({
					responseCode: 'CLIENT_ERROR',
					statusCode: httpStatusCode.bad_request,
					result: result,
					message: 'RESOURCE_VALIDATION_FAILED',
				})
			}

			//find existing reviews
			const existingReviews = await reviewsQueries.findAll({
				resource_id: programData.id,
			})

			// If no reviewerIds provided, reset status of all existing reviews
			if (!reviewerIds || reviewerIds.length === 0) {
				if (existingReviews.length > 0) {
					await reviewsQueries.update(
						{ resource_id: programData.id },
						{ status: common.REVIEW_STATUS_NOT_STARTED }
					)
				}
			} else {
				// reviewerIds are provided
				// Find reviews that already exist for the provided reviewerIds
				const existingReviewerReviews = await reviewsQueries.findAll({
					resource_id: programData.id,
					reviewer_id: {
						[Op.in]: reviewerIds.map((id) => id.toString()),
					},
				})
				const existingReviewerIdsFromProvided = new Set(existingReviewerReviews.map((r) => r.reviewer_id))

				// Prepare data to insert for new reviewers (if review does not exist yet)
				const inserts = reviewerIds
					.filter((reviewer_id) => !existingReviewerIdsFromProvided.has(reviewer_id))
					.map((reviewer_id) => ({
						resource_id: programData.id,
						reviewer_id,
						status: common.REVIEW_STATUS_NOT_STARTED,
						organization_code: userDetails.organization_code,
					}))

				// Prepare updates for existing reviewers
				const updates = reviewerIds.filter((reviewer_id) => existingReviewerIdsFromProvided.has(reviewer_id))

				// Execute updates and inserts
				await Promise.all(
					[
						// Update status for existing reviews for provided reviewers
						updates.length > 0 &&
							reviewsQueries.update(
								{
									resource_id: programData.id,
									reviewer_id: {
										[Op.in]: updates,
									},
								},
								{ status: common.REVIEW_STATUS_NOT_STARTED }
							),

						// Insert new reviews and related resources for new reviewers
						inserts.length > 0 &&
							Promise.all([
								reviewsResourcesQueries.bulkCreate(inserts.map(({ status, ...rest }) => rest)),
								reviewsQueries.bulkCreate(inserts),
							]),
					].filter(Boolean)
				)
			}

			let updateNextStage = true

			//update the reviews and resource status
			let resourceStatus = common.RESOURCE_STATUS_SUBMITTED
			if (
				programData.stage === common.RESOURCE_STAGE_REVIEW ||
				programData.status === common.RESOURCE_STATUS_SUBMITTED
			) {
				//Update the review status if the resource has been submitted before
				let updatedReviewCount = await reviewsQueries.update(
					{
						organization_code: programData.organization_code,
						resource_id: programData.id,
						status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
					},
					{
						status: common.REVIEW_STATUS_CHANGES_UPDATED,
					}
				)

				if (updatedReviewCount > 0) updateNextStage = false
			}

			//Open all draft comment when submitting the program for response
			await commentQueries.update(
				{
					user_id: userDetails.id,
					resource_id: {
						[Op.in]: [programId, ...resourceIds],
					},
					status: common.COMMENT_STATUS_DRAFT,
				},
				{
					status: common.COMMENT_STATUS_OPEN,
				}
			)

			//check review is required or not
			const isReviewMandatory = await resourceService.isReviewMandatory(
				programData.type,
				programData.organization_code,
				programData.tenant_code
			)

			// this will be handled while taking up program publish
			if (!isReviewMandatory) {
				const publishResource = await reviewService.publishResource(
					programData.id,
					programData.user_id,
					programData.organization_code,
					programData.tenant_code,
					userDetails.token
				)
				return publishResource
			}

			//update resource
			let resourcesUpdate = {
				status: resourceStatus,
				submitted_on: new Date(),
				is_under_edit: false,
				stage: common.RESOURCE_STAGE_REVIEW,
			}

			if (updateNextStage) {
				resourcesUpdate.next_stage = 1
			}

			if (bodyData.notes) {
				resourcesUpdate.meta = {
					...programData.meta,
					notes: bodyData.notes,
				}
			}

			await resourceQueries.updateOne({ id: programData.id }, resourcesUpdate)
			// add user action
			eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
				actionCode: common.USER_ACTIONS[programData.type].RESOURCE_SUBMITTED,
				userId: userDetails.id,
				objectId: programData.id,
				objectType: common.MODEL_NAMES.RESOURCE,
				orgId: userDetails.organization_code,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROGRAM_SUBMITTED_SUCCESSFULLY',
				result: { id: programData.id },
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || 'RESOURCE_VALIDATION_FAILED',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
	/**
	 * Publish program
	 * @method
	 * @name publish
	 * @param {string} programId - The ID of the program for submitting for review.
	 * @param {Object} userDetails - Object of user details
	 * @returns {JSON} - Response status of the submission
	 */
	static async publish(programId, userDetails) {
		try {
			let programDetails = await this.details(
				programId,
				userDetails.organization_code,
				userDetails.tenant_code,
				userDetails.token
			)
			if (programDetails.statusCode !== httpStatusCode.ok) {
				return responses.failureResponse({
					message: 'DONT_HAVE_PROGRAM_ACCESS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			let programData = programDetails.result

			const publishableProgramStatuses = [common.RESOURCE_STATUS_PUBLISHED, common.RESOURCE_STATUS_SUBMITTED]
			//check if the program status is valid to publish
			if (!publishableProgramStatuses.includes(programData.status)) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_PUBLISHED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			programData.meta = programData?.meta ? programData.meta : {}
			programData.meta.start_date = programData.start_date
			programData.meta.end_date = programData.end_date
			const resourceData = programData.resources
			const resourceIds = programData.resources.map((resource) => resource.id)
			const resourceTypes = [...resourceData.map((resource) => resource.type), 'resource']

			const validationErrors = await this.handleProgramValidation(
				programData,
				resourceIds,
				resourceData,
				resourceTypes
			)

			if (validationErrors.length > 0) {
				const result = Array.isArray(validationErrors) ? validationErrors.flat() : validationErrors || []
				return responses.failureResponse({
					responseCode: 'CLIENT_ERROR',
					statusCode: httpStatusCode.bad_request,
					result: result,
					message: 'RESOURCE_VALIDATION_FAILED',
				})
			}

			let rolloutId = await handleProgramRollouts(programData, programId, userDetails.id, userDetails.token)

			if (isNaN(rolloutId)) {
				throw new Error(rolloutId)
			}

			// publish program rollout
			const publishRollout = await rolloutService.publish(
				rolloutId,
				programData.user_id,
				programData.organization_code,
				userDetails.token
			)

			if (![httpStatusCode.ok, httpStatusCode.accepted].includes(publishRollout.statusCode)) {
				return responses.failureResponse({
					message: `Rollout publish failed: ${publishRollout.message || 'Unknown error'}`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//update the program resource
			await resourceQueries.updateOne(
				{ id: programId, organization_code: programData.organization_code },
				{
					status: common.RESOURCE_STATUS_PUBLISHED,
					stage: common.RESOURCE_STAGE_COMPLETION,
					published_on: new Date(),
					is_under_edit: false,
				}
			)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROGRAM_PUBLISHED',
				result: { id: programData.id },
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || 'RESOURCE_VALIDATION_FAILED',
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
				result: error.error || [],
			})
		}
	}

	/**
	 * Handle program validations
	 * @param {Object} programData - Program details
	 * @param {Array} resourceIds - List of resourceIds
	 * @param {Object} resourceData - resources details
	 * @param {Array} resourceTypes - List of resource Types
	 * @returns {Array} - Return array of error objects
	 */
	static async handleProgramValidation(programData, resourceIds, resourceData, resourceTypes, tenantCode) {
		try {
			const programTargeting = programData?.targeting_criteria
			// fetch the top level of entity in the hierarchy
			let { programTopLevelTargetingEntities, programLevelRoles } = await fetchProgramTopLevelEntities(
				programTargeting
			)

			let validationErrors = []

			if (
				programTargeting == undefined ||
				Object.keys(programTargeting).length <= 0 ||
				programTopLevelTargetingEntities.length <= 0
			) {
				validationErrors.push(
					utils.errorObject(
						`${common.RESOURCE_TYPE_PROGRAM}.targeting_criteria`,
						'targeting_criteria',
						'Target your Program to any targeting criteria.'
					)
				)
			}

			// Check if any resources are added to program
			if (resourceIds.length == 0) {
				validationErrors.push(
					utils.errorObject(common.RESOURCE_TYPE_PROGRAM, 'resources', `Atleast one resource is mandatory.`)
				)
			}

			//get all entity type validations for program
			let entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.RESOURCE_TYPE_PROGRAM,
					status: common.STATUS_ACTIVE,
				},
				programData.organization_code,
				tenantCode,
				['id', 'value', 'has_entities', 'validations']
			)

			let basePath = ''
			//validate program data
			const programValidationPromises = entityTypes.map((entityType) => {
				validateEntityData(programData, entityType, common.RESOURCE_TYPE_PROGRAM, basePath, validationErrors)
			})

			await Promise.all(programValidationPromises)

			if (resourceIds.length > 0) {
				let resourceValidationErrors = []

				let resourceEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
					{
						model: {
							[Op.in]: resourceTypes,
						},
						status: common.STATUS_ACTIVE,
					},
					programData.organization_code,
					tenantCode,
					['id', 'value', 'has_entities', 'validations']
				)
				let { programTopLevelTargetingEntities, programLevelRoles } = await fetchProgramTopLevelEntities(
					programTargeting
				)
				const resourcesValidationPromise = resourceData.map(async (resource, index) => {
					const basePath = `${common.RESOURCES}[${index}]`
					validateResources(
						resource,
						programTopLevelTargetingEntities,
						programTargeting,
						programLevelRoles,
						programData,
						resourceEntityTypes,
						basePath,
						(resourceValidationErrors = [])
					)
				})

				await Promise.all(resourcesValidationPromise)
				let resourceErrors = await Promise.all(resourceValidationErrors)

				resourceErrors =
					resourceErrors.length > 0 ? resourceErrors.filter((error) => error?.hasError === true) : []
				if (resourceErrors.length > 0) {
					resourceErrors.forEach((error) => {
						if (
							error?.hasError &&
							Array.isArray(error.validationErrors) &&
							error.validationErrors.length > 0
						) {
							validationErrors.push(...error.validationErrors)
						} else if (error?.hasError && Array.isArray(error.error) && error.error.length > 0) {
							validationErrors.push(...error.error)
						}
					})
				}
			}

			return validationErrors
		} catch (error) {
			return responses.failureResponse({
				message: error.message,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
				result: error.error || [],
			})
		}
	}
}

/**
 * fetch the top level entities from program
 * @param {Object} programTargeting - Program targeting object
 * @returns {Object} - Object of entities and role
 */
async function fetchProgramTopLevelEntities(programTargeting) {
	let programTopLevelTargetingEntities = []
	let programLevelRoles = []
	programTargeting.forEach((targeting) => {
		targeting?.[process.env.HIGHEST_IN_ENTITY_HIERARCHY].forEach((eachTarget) => {
			programTopLevelTargetingEntities.push(eachTarget._id)
		})
		programLevelRoles = [...programLevelRoles, ...targeting['roles'].map((roles) => roles._id)]
	})
	return { programTopLevelTargetingEntities, programLevelRoles }
}

/**
 * Handle program rollout publish
 * @param {Object} resourceData - resources details
 * @param {Integer} resourceId - Rollout resourceId
 * @param {String} userId - Logged in user id
 * @returns {Integer} - Return rollout id or validation error
 */
async function handleProgramRollouts(resourceData, resourceId, userId, userToken = false) {
	let rolloutId = null
	if (resourceData?.published_id) {
		// if program is already rolled out
		rolloutId = await rolloutService.updateProgramRollout(
			resourceId,
			resourceData,
			userId,
			resourceData.organization_code,
			userToken
		)
	} else {
		// while program publishing first time
		rolloutData = await rolloutService.createProgramRollout(resourceData, userId, userToken)
		if (!rolloutData?.success) {
			throw new Error(rolloutData?.error)
		}
		rolloutId = rolloutData.rolloutId
	}
	return rolloutId
}
/**
 * Handles resources by duplicating reusable resources and mapping them to the program and user.
 * @param {Array} resources - List of resources to process.
 * @param {string} programId - The ID of the program to which resources will be mapped.
 * @param {string} orgId - The ID of the organization.
 * @param {string} loggedInUserId - The ID of the logged-in user.
 * @param {boolean} isResuableFalseResourceCreate - Flag to indicate if non-reusable resources should be created.
 * @returns {Array} - List of resource IDs.
 */
async function handleResources(
	resources,
	programId,
	orgId,
	tenantCode,
	loggedInUserId,
	isResuableFalseResourceCreate = false,
	userToken = ''
) {
	try {
		// Return early if no resources are provided
		if (!resources?.length) return

		// Extract resource IDs from the input resources
		const resourceIds = resources.map((res) => res.id)
		if (resourceIds.length === 0) return

		// Fetch resources from the database
		const resourceList = await resourceQueries.findAll({
			id: { [Op.in]: resourceIds },
			organization_code: orgId,
			tenant_code: tenantCode,
		})

		if (!resourceList?.length) return

		// Fetch details for all resources in parallel
		const resourceDetailsPromises = resourceList.map(async (resource) => {
			const details = await resourceService.getDetails(
				resource.id,
				resource.organization_code,
				tenantCode,
				userToken
			)
			return { id: resource.id, result: details?.result }
		})

		const resourceDetailsResults = await Promise.all(resourceDetailsPromises)

		// Create a map of resource details for quick lookup
		const resourceDetailsMap = new Map()
		for (const { id, result } of resourceDetailsResults) {
			if (result) {
				resourceDetailsMap.set(id, result)
			}
		}

		let duplicateResourceIds = []

		// Process each resource in the input array
		await Promise.all(
			resources.map(async (resource) => {
				const resourceDetails = resourceDetailsMap.get(resource.id)
				const isReusable = resourceDetails?.is_reusable

				const commonFields = {
					user_id: loggedInUserId,
					organization_code: orgId,
					tenant_code: tenantCode,
					updated_by: loggedInUserId,
					created_at: new Date(),
					updated_at: new Date(),
				}

				if (resourceDetails) {
					// Prepare data for duplicating reusable resource
					if (isReusable || isResuableFalseResourceCreate) {
						// Create a duplicate of the reusable resource
						const duplicatedResourceData = {
							..._.omit(resourceDetails, ['created_at', 'updated_at', 'is_comments']),
							...resource,
							...commonFields,
							is_reusable: false,
							created_by: loggedInUserId,
							status: common.RESOURCE_STATUS_PUBLISHED,
							stage: common.RESOURCE_STAGE_COMPLETION,
							published_id: null,
							published_on: null,
						}
						delete duplicatedResourceData.id // Remove the ID to create a new resource

						// Create the duplicated resource in the database
						const duplicateResource = await resourceQueries.create(duplicatedResourceData)
						duplicateResourceIds.push(duplicateResource.id)

						// Map the duplicated resource to the creator and program
						await Promise.all([
							// Map the duplicated resource to the creator
							resourceCreatorMappingQueries.create({
								resource_id: duplicateResource.id,
								creator_id: loggedInUserId,
								organization_code: orgId,
								tenant_code: tenantCode,
							}),
							// Map the duplicated resource to the program
							programResourceMappingQueries.create({
								program_id: programId,
								resource_id: duplicateResource.id,
								organization_code: orgId,
								tenant_code: tenantCode,
							}),
						])

						// Upload the duplicated resource to the cloud
						await resourceService.uploadAndUpdateResource(
							duplicateResource.id,
							orgId,
							tenantCode,
							loggedInUserId,
							duplicatedResourceData,
							common.UPLOAD_FILE_NAME[duplicateResource.type],
							duplicateResource.type
						)

						// Update the resource ID in the input array
						resource.id = duplicateResource.id
					} else {
						// Update the existing resource
						let updatedResourceData = _.omit(
							{ ..._.pick(resource, Object.keys(resourceDetails)), ...resource },
							[
								'status',
								'stage',
								'next_stage',
								'review_type',
								'reference_id',
								'published_id',
								'submitted_on',
								'published_on',
								'last_reviewed_on',
								'is_under_edit',
								'is_comments',
								'created_at',
								'updated_at',
							]
						)

						await resourceService.uploadAndUpdateResource(
							updatedResourceData.id,
							orgId,
							tenantCode,
							loggedInUserId,
							updatedResourceData,
							common.UPLOAD_FILE_NAME[resourceDetails.type],
							resourceDetails.type
						)
					}
				}
			})
		)
		return duplicateResourceIds
	} catch (error) {
		throw error
	}
}

const _nonReviewableResourceStatuses = [
	common.RESOURCE_STATUS_REJECTED,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
	common.RESOURCE_STATUS_SUBMITTED,
	common.REVIEW_STATUS_CHANGES_UPDATED,
	common.REVIEW_STATUS_INPROGRESS,
]

/**
 * Validates the given program data
 * @method
 * @name validateEntityData
 * @param {Object} entityData - Data which needs to validate
 * @param {Object} entityType - Each entityType which have models
 * @param {string} model - The model needs to validate ex: program
 * @param {string} sourceType - Specifies the source of the input, which can be 'body', 'param', or 'query'.
 * @returns {JSON} - Response containing error details, if any.
 */
async function validateEntityData(entityData, entityType, model, sourceType, validationErrors = []) {
	try {
		let fieldData = entityData[entityType.value]

		// Check if the field is required
		let requiredValidation = entityType.validations.find(
			(validation) => validation.type == common.REQUIRED_VALIDATION
		)
		if (requiredValidation) {
			let required = utils.checkRequired(requiredValidation, fieldData)
			if (!required) {
				validationErrors.push(
					utils.errorObject(
						model == common.RESOURCE_TYPE_PROGRAM ? entityType.value : sourceType,
						model === common.RESOURCE_TYPE_PROGRAM ? '' : entityType.value,
						`${entityType.value} is required`
					)
				)
			}
		}

		//length check validation
		let maxLengthValidation = entityType.validations.find(
			(validation) => validation.type == common.MAX_LENGTH_VALIDATION
		)

		if (maxLengthValidation && typeof fieldData === common.STRING && fieldData !== null) {
			let lengthCheck = utils.checkLength(maxLengthValidation, fieldData)

			if (!lengthCheck) {
				validationErrors.push(
					utils.errorObject(
						common.RESOURCE_TYPE_PROGRAM,
						entityType.value,
						`${entityType.value} must not exceed ${maxLengthValidation.value} characters `
					)
				)
			}
		}

		// Check if the entity has sub-entities
		if (entityType.has_entities) {
			let checkEntities = utils.checkEntities(entityType, fieldData)
			if (!checkEntities.status) {
				validationErrors.push(
					utils.errorObject(common.RESOURCE_TYPE_PROGRAM, entityType.value, checkEntities.message)
				)
			}
		}

		// Check regex pattern will check max length and special characters
		let regexValidation = entityType.validations.find((validation) => validation.type == common.REGEX_VALIDATION)
		if (regexValidation && fieldData) {
			let checkRegex = utils.checkRegexPattern(regexValidation, fieldData)
			if (!checkRegex) {
				validationErrors.push(
					utils.errorObject(
						common.RESOURCE_TYPE_PROGRAM,
						entityType.value,
						`${entityType.value} can only include alphanumeric characters with spaces, -, _, &, <>`
					)
				)
			}
		}

		let endDateCheck = entityType.validations.find((validation) => validation.type == common.END_DATE_VALIDATION)
		if (endDateCheck && typeof rollout[entityType.value] === common.STRING && rollout[entityType.value] !== null) {
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
		if (validationErrors.length > 0) {
			const result = Array.isArray(validationErrors) ? validationErrors.flat() : validationErrors || []
			return responses.failureResponse({
				responseCode: 'CLIENT_ERROR',
				statusCode: httpStatusCode.bad_request,
				result: result,
				message: 'RESOURCE_VALIDATION_FAILED',
			})
		}

		// No errors, return null
		return {
			hasError: false,
			error: [],
		}
	} catch (error) {
		return error
	}
}

/**
 * Validates whether the resource targeting criteria is a subset of the program targeting criteria.
 * @method
 * @name validateTargetingCriteria
 * @param {Array<Object>} programTargetring - The program targeting criteria containing various targeting keys with `_id` values.
 * @param {Array<Object>} resourceTargeting - The resource targeting criteria that needs to be validated against the program targeting.
 * @returns {Promise<boolean>} - A promise that resolves to `true` if resourceTargeting is a subset of programTargetring, otherwise `false`.
 */
async function validateTargetingCriteria(programTargetring, programTopLevelTargetingEntities, resourceTargeting) {
	const isValid = resourceTargeting.every((resourceTarget) =>
		resourceTarget?.[process.env.HIGHEST_IN_ENTITY_HIERARCHY]?.every((entity) =>
			programTopLevelTargetingEntities.includes(entity._id)
		)
	)

	if (!isValid) {
		return false
	}
	// Extract _id values for each key using lodash reduce
	const programTargetings = _.reduce(
		programTargetring,
		(acc, targeting) => {
			_.forEach(targeting, (value, key) => {
				if (_.isArray(value)) {
					acc[key] = (acc[key] || []).concat(_.map(value, '_id'))
				}
			})
			return acc
		},
		{}
	)

	const resourceTargetings = _.reduce(
		resourceTargeting,
		(acc, targeting) => {
			_.forEach(targeting, (value, key) => {
				if (_.isArray(value)) {
					acc[key] = (acc[key] || []).concat(_.map(value, '_id'))
				}
			})
			return acc
		},
		{}
	)

	// Check if resourceTargetings is a subset of programTargetings
	const isSubset = _.every(
		resourceTargetings,
		(ids, key) => _.isArray(programTargetings[key]) && _.difference(ids, programTargetings[key]).length === 0
	)

	return isSubset
}

/**
 * Validates whether the Reviewers list given is valid or not
 * @method
 * @name validateReviewers
 * @param {Array} reviewerIds - Array of reviewer ids
 * @param {Object} userDetails - Logged in user details.
 * @returns {Array} - Array of valid reviewer ids or error.
 */
async function validateReviewers(reviewerIds, userDetails) {
	if (!reviewerIds || reviewerIds.length === 0) return []

	const uniqueReviewerIds = utils.getUniqueElements(reviewerIds)
	const reviewers = await userRequests.list(
		common.REVIEWER,
		'',
		'',
		'',
		userDetails.organization_code,
		userDetails.tenant_code,
		{
			user_ids: uniqueReviewerIds,
			excluded_user_ids: [userDetails.id],
		},
		userDetails.token
	)

	if (!reviewers.success || uniqueReviewerIds.length > reviewers.data.result.data.length) {
		throw new Error('REVIEWER_IDS_NOT_FOUND')
	}

	return reviewers.data.result.data.map((item) => item.id)
}

/**
 * Validates whether the resources have any error before submiting
 * @method
 * @name validateResources
 * @param {Object} resource - Array of reviewer ids
 * @param {Object} resourceEntityTypes - Entity type details and validations for resources
 * @param {String} basePath - Base bath of the resource in the program
 * @param {Array} resourceValidationErrors - Array of resource level validation error.
 * @returns {Promise<void>} - Returns a promise of errors.
 */
async function validateResources(
	resource,
	programTopLevelTargetingEntities,
	programTargeting,
	programLevelRoles,
	programData,
	resourceEntityTypes,
	basePath,
	resourceValidationErrors = []
) {
	if (!resource?.targeting_criteria || Object.keys(resource.targeting_criteria).length === 0) {
		resourceValidationErrors.push(
			utils.errorObject(
				`${basePath}.targeting_criteria`,
				'targeting_criteria',
				`Target your Resource to any targeting criteria under program scope.`
			)
		)
	} else {
		const validateResourceScope = await validateTargetingCriteria(
			programTargeting,
			programTopLevelTargetingEntities,
			resource.targeting_criteria
		)
		if (!validateResourceScope) {
			resourceValidationErrors.push(
				utils.errorObject(
					`${basePath}.targeting_criteria`,
					'targeting_criteria',
					'Resource targeting should be under Program Scope.'
				)
			)
		}
	}
	let roleValidationFlag = true
	if (Array.isArray(resource?.targeting_criteria)) {
		resource.targeting_criteria.forEach((targeting) => {
			if (Array.isArray(targeting.roles)) {
				targeting.roles.forEach((role) => {
					if (!programLevelRoles.includes(role._id)) roleValidationFlag = false
				})
			} else {
				resourceValidationErrors.push(
					utils.errorObject(
						`${basePath}.targeting_criteria.roles`,
						'roles',
						'Roles should be an array inside targeting_criteria.'
					)
				)
			}
		})
	}

	if (!roleValidationFlag) {
		resourceValidationErrors.push(
			utils.errorObject(
				`${basePath}.targeting_criteria`,
				'roles',
				'Roles in targeting should be under Program Scope.'
			)
		)
	}

	resourceEntityTypes.map((entityType) => {
		if (resource.type == common.PROJECT) {
			resourceValidationErrors.push(
				projectService.validateEntityData(
					resource,
					entityType,
					common.RESOURCE_TYPE_PROGRAM,
					basePath,
					resourceValidationErrors
				)
			)
		}
	})
	//rest of the resource type validations will be added incrementally.

	// check resource start date , end date
	if (resource?.[common.START_DATE] != undefined && resource?.[common.END_DATE] != undefined) {
		const validateEndDate = utils.checkEndDate(resource[common.START_DATE], resource[common.END_DATE])
		if (!validateEndDate) {
			resourceValidationErrors.push(
				utils.errorObject(basePath, common.START_DATE, 'End date should be greater than the start date.')
			)
		}
	}

	// check if the resource start date lies with-in the program date range
	if (resource?.[common.START_DATE] != undefined && programData?.[common.START_DATE] != undefined) {
		const validateProgramResourceStartDate = utils.checkEndDate(
			programData?.[common.START_DATE],
			resource?.[common.START_DATE]
		)
		if (!validateProgramResourceStartDate) {
			resourceValidationErrors.push(
				utils.errorObject(
					basePath,
					common.START_DATE,
					'Resource Start date should be within program Date Range.'
				)
			)
		}
	}
	// check if the resource end date lies with-in the program date range
	if (resource?.[common.END_DATE] != undefined && programData?.[common.END_DATE] != undefined) {
		const validateProgramResourceStartDate = utils.checkEndDate(
			resource[common.END_DATE],
			programData?.[common.END_DATE]
		)
		if (!validateProgramResourceStartDate) {
			resourceValidationErrors.push(
				utils.errorObject(basePath, common.END_DATE, 'Resource End date should be within program Date Range.')
			)
		}

		const now = new Date()
		if (resource[common.END_DATE] < now) {
			resourceValidationErrors.push(
				utils.errorObject(basePath, common.END_DATE, `Resource End date cannot be less than current date.`)
			)
		}
	}
}

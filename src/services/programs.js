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
module.exports = class ProgramsHelper {
	/**
	 * Program create
	 * @method
	 * @name create
	 * @param {Object} bodyData - Request body data.
	 * @param {string} loggedInUserId - The ID of the logged-in user.
	 * @param {string} orgId - The ID of the organization.
	 * @returns {JSON} - Program ID or error response.
	 */
	static async create(bodyData, loggedInUserId, orgId) {
		try {
			// Get the review type of the organization
			const orgConfig = await orgExtensionService.getConfig(orgId)
			const orgConfigList = _.reduce(
				orgConfig.result.resource,
				(acc, item) => {
					acc[item.resource_type] = item.review_type
					return acc
				},
				{}
			)

			// Construct the program data
			let programData = {
				title: bodyData.title,
				type: common.RESOURCE_TYPE_PROGRAM,
				status: common.RESOURCE_STATUS_DRAFT,
				stage: common.RESOURCE_STAGE_CREATION,
				user_id: loggedInUserId,
				review_type: orgConfigList[common.RESOURCE_TYPE_PROGRAM],
				organization_id: orgId,
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
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
				organization_id: orgId,
			}
			await resourceCreatorMappingQueries.create(mappingData)

			// Handle resources if present in the request
			if (bodyData?.resources?.length > 0) {
				await handleResources(bodyData.resources, programId, orgId, loggedInUserId)
			}

			try {
				// Upload program to cloud
				if (programId) {
					await uploadAndUpdateResource(
						programId,
						orgId,
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
	 * @param {string} orgId - The ID of the organization.
	 * @returns {JSON} - Program ID or error response.
	 */
	static async update(resourceId, bodyData, loggedInUserId, orgId) {
		try {
			const forbidden_resource_statuses = [
				common.RESOURCE_STATUS_PUBLISHED,
				common.RESOURCE_STATUS_REJECTED,
				common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
				common.RESOURCE_STATUS_SUBMITTED,
				common.REVIEW_STATUS_INPROGRESS,
			]

			// Fetch the program to be updated
			const fetchResource = await resourceQueries.findOne({
				id: resourceId,
				organization_id: orgId,
				status: {
					[Op.notIn]: forbidden_resource_statuses,
				},
				stage: {
					[Op.notIn]: [common.RESOURCE_STAGE_COMPLETION],
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
					organization_id: orgId,
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
				'organization_id',
				'user_id',
				'is_resuable',
				'stage',
				'status',
			])

			// Fetch existing resource mappings for the program
			const existingMappings = await programResourceMappingQueries.findAll({
				program_id: programId,
				organization_id: fetchResource.organization_id,
			})

			// Delete removed resources from programResourceMapping
			const existingResourceIds = existingMappings.map((mapping) => mapping.resource_id)
			const updatedResourceIds = bodyData.resources?.map((res) => res.id) || []
			const resourcesToRemove = existingResourceIds.filter((id) => !updatedResourceIds.includes(id))

			if (resourcesToRemove.length > 0) {
				await programResourceMappingQueries.deleteMany(resourceId, resourcesToRemove)
			}

			// Identify new resources to be added
			const newResources = bodyData.resources?.filter((res) => !existingResourceIds.includes(res.id)) || []
			// Handle new resources (create duplicates, upload to cloud, and map to program)
			if (newResources.length > 0) {
				await handleResources(newResources, resourceId, orgId, loggedInUserId)
			}

			//Upload program information to cloud
			await uploadAndUpdateResource(
				programId,
				orgId,
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
					start_date: bodyData.start_date || '',
					end_date: bodyData.end_date || '',
				},
			}

			const [updateCount, updatedProgram] = await resourceQueries.updateOne(
				{ id: resourceId, organization_id: orgId },
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
				message:
					fetchResource.stage == common.RESOURCE_STAGE_REVIEW
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
	static async details(programId, orgId, loggedInUserId) {
		try {
			let result = {
				organization: {},
			}

			const program = await resourceQueries.findOne({
				id: programId,
				organization_id: orgId,
				user_id: loggedInUserId,
			})

			if (!program?.id) {
				return responses.failureResponse({
					message: 'PROGRAM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//get the data from storage
			if (program.blob_path) {
				const response = await filesService.fetchJsonFromCloud(program.blob_path)

				if (
					response.statusCode === httpStatusCode.ok &&
					response.result &&
					Object.keys(response.result).length > 0
				) {
					let resultData = {
						...program,
						...response.result,
					}

					resultData.viewers = []

					// fetch the user if viewer is present
					if (response?.result?.viewers?.length > 0) {
						const viewerUserIds = response.result.viewers
						const userDetails = await this.fetchUserDetails(viewerUserIds)

						if (userDetails && Object.keys(userDetails).length > 0) {
							resultData.viewers = viewerUserIds.map((user) => {
								return userDetails[user]
							})
						}
					}

					// fetch the org details from user service
					const organizationDetails = await orgExtensionService.fetchOrganizationDetails([
						program.organization_id,
					])
					if (organizationDetails?.[program.organization_id]) {
						resultData.organization = _.pick(organizationDetails[program.organization_id], [
							'id',
							'name',
							'code',
						])
					}
					result = { ...resultData, resources: [] }
				}
			}

			//get resource details
			const associatedResources = await programResourceMappingQueries.findAll({
				program_id: programId,
				organization_id: program.organization_id,
			})

			if (associatedResources.length > 0) {
				const resourceIds = associatedResources.map((resource) => resource.resource_id)

				const resources = await resourceQueries.findAll({
					id: { [Op.in]: resourceIds },
					organization_id: orgId,
				})

				if (resources.length > 0) {
					// Process each resource and store in result.resources
					await Promise.all(
						resources.map(async (resource) => {
							const resourceDetails = await resourceService.getDetails(
								resource.id,
								resource.organization_id
							)
							console.log(resourceDetails, 'resourceDetails')
							// If the resource details are fetched successfully, add them to result.resources
							if (resourceDetails.statusCode === httpStatusCode.ok) {
								result.resources.push(resourceDetails.result)
							}
						})
					)
				}
			}
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
	static async fetchUserDetails(userIds) {
		const userDetailsResponse = await userRequests.list(common.FILTER_ALL.toLowerCase(), '', '', '', '', {
			user_ids: userIds,
		})
		let userDetails = {}
		if (userDetailsResponse.success && userDetailsResponse.data?.result?.data?.length > 0) {
			userDetails = _.keyBy(userDetailsResponse.data.result.data, 'id')
		}
		return userDetails
	}
}

/**
 * Handles resources by duplicating reusable resources and mapping them to the program and user.
 * @param {Array} resources - List of resources to process.
 * @param {string} programId - The ID of the program to which resources will be mapped.
 * @param {string} orgId - The ID of the organization.
 * @param {string} loggedInUserId - The ID of the logged-in user.
 */
async function handleResources(resources, programId, orgId, loggedInUserId) {
	try {
		// Return early if no resources are provided
		if (!resources?.length) return

		// Extract resource IDs from the input resources
		const resourceIds = resources.map((res) => res.id)
		if (resourceIds.length === 0) return

		// Fetch resources from the database
		const resourceList = await resourceQueries.findAll({
			id: { [Op.in]: resourceIds },
			organization_id: orgId,
		})

		if (!resourceList?.length) return

		// Create a map of resource details for quick lookup
		const resourceDetailsMap = new Map()
		for (const resource of resourceList) {
			if (resource.is_reusable) {
				const resourceDetails = await resourceService.getDetails(resource.id, resource.organization_id)
				if (resourceDetails?.result) {
					resourceDetailsMap.set(resource.id, resourceDetails.result)
				}
			}
		}

		// Process each resource in the input array
		await Promise.all(
			resources.map(async (resource) => {
				const resourceDetails = resourceDetailsMap.get(resource.id)
				const isReusable = resourceDetails?.is_reusable

				const commonFields = {
					user_id: loggedInUserId,
					organization_id: orgId,
					updated_by: loggedInUserId,
					updated_at: new Date(),
				}

				if (resourceDetails) {
					// Prepare data for duplicating reusable resource
					if (isReusable) {
						// Create a duplicate of the reusable resource
						const duplicatedResourceData = {
							..._.omit(resourceDetails, ['created_at', 'updated_at']),
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

						// Map the duplicated resource to the creator and program
						await Promise.all([
							// Map the duplicated resource to the creator
							resourceCreatorMappingQueries.create({
								resource_id: duplicateResource.id,
								creator_id: loggedInUserId,
								organization_id: orgId,
							}),
							// Map the duplicated resource to the program
							programResourceMappingQueries.create({
								program_id: programId,
								resource_id: duplicateResource.id,
								organization_id: orgId,
							}),
						])

						// Upload the duplicated resource to the cloud
						await uploadAndUpdateResource(
							duplicateResource.id,
							orgId,
							loggedInUserId,
							duplicatedResourceData,
							common.UPLOAD_FILE_NAME[duplicateResource.type],
							duplicateResource.type
						)

						// Update the resource ID in the input array
						resource.id = duplicateResource.id
					} else {
						// Update the existing resource
						const updatedResourceData = {
							...resourceDetails,
							...resource,
							...commonFields,
						}

						await uploadAndUpdateResource(
							updatedResourceData.id,
							orgId,
							loggedInUserId,
							updatedResourceData,
							common.UPLOAD_FILE_NAME[updatedResourceData.type],
							updatedResourceData.type
						)
					}
				}
			})
		)
	} catch (error) {
		throw error
	}
}
/**
 * Uploads a resource to the cloud and updates its metadata in the database.
 * @param {string} resourceId - The ID of the resource to upload and update.
 * @param {string} orgId - The ID of the organization associated with the resource.
 * @param {string} loggedInUserId - The ID of the user performing the operation.
 * @param {Object} data - The data to be uploaded to the cloud.
 * @param {string} fileName - The name of the file to be uploaded.
 * @param {string} resourceType - The type of the resource (e.g., 'program', 'project').
 * @returns {Promise<void>} - Resolves when the upload and update are successful.
 */
async function uploadAndUpdateResource(resourceId, orgId, loggedInUserId, data, fileName, resourceType) {
	try {
		const uploadStatus = await resourceService.uploadToCloud(
			fileName,
			resourceId,
			resourceType,
			loggedInUserId,
			data
		)

		if (uploadStatus.result.status === httpStatusCode.ok || uploadStatus.result.status === httpStatusCode.created) {
			const filter = { id: resourceId, organization_id: orgId }
			const updateData = { updated_by: loggedInUserId, blob_path: uploadStatus.blob_path }

			const [updateCount, updatedResource] = await resourceQueries.updateOne(filter, updateData, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				throw new Error('RESOURCE_NOT_FOUND')
			}

			return updatedResource
		} else {
			throw new Error('FILE_UPLOADED_FAILED')
		}
	} catch (error) {
		throw error
	}
}

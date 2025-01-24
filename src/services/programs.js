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
				review_type: orgConfigList[common.PROJECT],
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
			const mappingData = {
				resource_id: programCreate.id,
				creator_id: loggedInUserId,
				organization_id: orgId,
			}
			await resourceCreatorMappingQueries.create(mappingData)
			const programId = programCreate?.id

			// Handle resources if present in the request
			if (bodyData?.resources?.length > 0) {
				await handleResources(bodyData.resources, programId, orgId, loggedInUserId)
			}

			try {
				// Upload program to cloud
				if (programId) {
					const programUploadStatus = await resourceService.uploadToCloud(
						common.PROGRAM_UPLOAD_FILE_NAME,
						programId,
						common.RESOURCE_TYPE_PROGRAM,
						loggedInUserId,
						bodyData
					)

					if (
						programUploadStatus.result.status == httpStatusCode.ok ||
						programUploadStatus.result.status == httpStatusCode.created
					) {
						let filter = {
							id: programId,
							organization_id: orgId,
						}

						let updateData = {
							updated_by: loggedInUserId,
							blob_path: programUploadStatus.blob_path,
						}

						const [updateCount] = await resourceQueries.updateOne(filter, updateData, {
							returning: true,
							raw: true,
						})

						if (updateCount === 0) {
							return responses.failureResponse({
								message: 'PROGRAM_NOT_FOUND',
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
							})
						}
					} else {
						throw new Error('FILE_UPLOADED_FAILED')
					}
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
}

/**
 * Handles resources by duplicating reusable resources and mapping them to the program and user.
 * @param {Array} resources - List of resources to process.
 * @param {string} programId - The ID of the program to which resources will be mapped.
 * @param {string} orgId - The ID of the organization.
 * @param {string} loggedInUserId - The ID of the logged-in user.
 */
async function handleResources(resources, programId, orgId, loggedInUserId) {
	// Extract resource IDs from the input resources
	const resourceIds = resources.map((res) => res.id)
	if (resourceIds.length === 0) return

	// Fetch resources from the database
	const resourceList = await resourceQueries.findAll({
		id: { [Op.in]: resourceIds },
		organization_id: orgId,
	})

	if (!resourceList || resourceList.length === 0) {
		return
	}

	// Process each resource
	for (let resource of resourceList) {
		if (resource.is_reusable) {
			let resourceDetails = await resourceService.getDetails(resource.id, resource.organization_id)
			if (resourceDetails?.result) {
				let matchingResource = resources.find((res) => res.id === resource.id)
				let duplicatedResourceData = {
					..._.omit(resourceDetails.result, ['created_at', 'updated_at']),
					...matchingResource,
					is_resuable: false,
					user_id: loggedInUserId,
					created_by: loggedInUserId,
					updated_by: loggedInUserId,
					status: common.RESOURCE_STATUS_PUBLISHED,
					stage: common.RESOURCE_STAGE_COMPLETION,
					published_id: null,
					published_on: null,
					organization_id: orgId,
				}
				delete duplicatedResourceData.id
				// Create the duplicated resource in the database
				const duplicateResource = await resourceQueries.create(duplicatedResourceData)

				// Map the duplicated resource to the creator
				await resourceCreatorMappingQueries.create({
					resource_id: duplicateResource.id,
					creator_id: loggedInUserId,
					organization_id: orgId,
				})

				//Upload the duplicate resource details to cloud
				let resourceUploadStatus = await resourceService.uploadToCloud(
					common.UPLOAD_FILE_NAME[resource.type],
					duplicateResource.id,
					duplicateResource.type,
					loggedInUserId,
					_.omit(duplicatedResourceData, [
						'id',
						'is_resuable',
						'user_id',
						'created_by',
						'updated_by',
						'status',
						'stage',
						'',
					])
				)

				if (
					resourceUploadStatus.result.status == httpStatusCode.ok ||
					resourceUploadStatus.result.status == httpStatusCode.created
				) {
					let filter = {
						id: duplicateResource.id,
						organization_id: duplicateResource.organization_id,
					}

					let updateData = {
						updated_by: loggedInUserId,
						blob_path: resourceUploadStatus.blob_path,
					}

					const [updateCount] = await resourceQueries.updateOne(filter, updateData, {
						returning: true,
						raw: true,
					})

					if (matchingResource) {
						matchingResource.id = duplicateResource.id
					}

					// Map the duplicated resource to the program
					await programResourceMappingQueries.create({
						program_id: programId,
						resource_id: duplicateResource.id,
						organization_id: orgId,
					})
				}
			}
		}
	}
}

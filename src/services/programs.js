/* eslint-disable no-useless-catch */
const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const resourceCreatorMappingQueries = require('@database/queries/resourcesCreatorMapping')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const orgExtensionService = require('@services/organization-extension')
const _ = require('lodash')
const { Op } = require('sequelize')
const utils = require('@generics/utils')
const resourceService = require('@services/resource')
const programResourceMappingQueries = require('@database/queries/ProgramResourceMapping')
module.exports = class ProgramsHelper {
	/**
	 * Program create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - program id
	 */
	static async create(bodyData, loggedInUserId, orgId) {
		try {
			//validate the title length
			const isTitleInvalid = utils.validateTitle(bodyData.title)
			if (isTitleInvalid) {
				return responses.failureResponse({
					message: 'CHARACTER_LIMIT_EXCEED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const orgConfig = await orgExtensionService.getConfig(orgId)
			const orgConfigList = _.reduce(
				orgConfig.result.resource,
				(acc, item) => {
					acc[item.resource_type] = item.review_type
					return acc
				},
				{}
			)

			let programData = {
				title: bodyData.title,
				type: common.RESOURCE_TYPE_PROGRAM,
				status: common.RESOURCE_STATUS_DRAFT,
				stage: common.RESOURCE_STAGE_CREATION,
				user_id: loggedInUserId,
				review_type: orgConfigList[common.PROJECT],
				organization_id: orgId,
				meta: {},
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
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
				if (programCreate?.id) {
					const programUploadStatus = await resourceService.uploadToCloud(
						common.PROJECT_UPLOAD_FILE_NAME,
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
								message: 'PROJECT_NOT_FOUND',
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
 * Duplicate creation of resource
 * @method
 * @name handleResources
 * @param {Object} req - request data.
 * @returns {JSON} - Duplicate Resource .
 */
async function handleResources(resources, programId, orgId, loggedInUserId) {
	const resourceIds = resources.map((res) => res.id)
	if (resourceIds.length === 0) return

	const resourceList = await resourceQueries.findAll({
		where: {
			id: { [Op.in]: resourceIds },
			organization_id: orgId,
		},
	})

	for (const resource of resourceList) {
		if (resource.is_resuable) {
			const duplicatedResourceData = {
				...resource,
				is_resuable: false,
				user_id: loggedInUserId,
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
				status: common.RESOURCE_STATUS_PUBLISHED,
				stage: common.RESOURCE_STAGE_COMPLETION,
				published_id: null,
			}
			delete duplicatedResourceData.id

			const duplicateResource = await resourceQueries.create(duplicatedResourceData)

			await resourceCreatorMappingQueries.create({
				resource_id: duplicateResource.id,
				creator_id: loggedInUserId,
				organization_id: orgId,
			})

			const matchingResource = resources.find((res) => res.id === resource.id)
			if (matchingResource) {
				matchingResource.id = duplicateResource.id
			}

			// Add to the mapping table
			await programResourceMappingQueries.create({
				program_id: programId,
				resource_id: duplicateResource.id,
				organization_id: orgId,
			})
		}
	}
}

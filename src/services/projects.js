const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const resourceCreatorMappingQueries = require('@database/queries/resourcesCreatorMapping')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const filesService = require('@services/files')
const userRequests = require('@requests/user')
const configService = require('@services/config')
const _ = require('lodash')
const axios = require('axios')
const { Op } = require('sequelize')
const reviewsQueries = require('@database/queries/reviews')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const entityService = require('@services/entities')
const utils = require('@generics/utils')

module.exports = class ProjectsHelper {
	/**
	 *  project create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - project id
	 */
	static async create(orgId, loggedInUserId, bodyData) {
		try {
			const orgConfig = await configService.list(orgId)

			const orgConfigList = _.reduce(
				orgConfig.result,
				(acc, item) => {
					acc[item.resource_type] = item.review_type
					return acc
				},
				{}
			)

			let projectData = {
				title: bodyData.title,
				type: common.PROJECT,
				status: common.STATUS_DRAFT,
				user_id: loggedInUserId,
				review_type: orgConfigList[common.PROJECT],
				organization_id: orgId,
				meta: {},
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
			}

			let projectCreate
			try {
				projectCreate = await resourceQueries.create(projectData)
				const mappingData = {
					resource_id: projectCreate.id,
					creator_id: loggedInUserId,
					organization_id: orgId,
				}
				await resourceCreatorMappingQueries.create(mappingData)

				//upload to blob
				await this.uploadToCloud(projectCreate.id, loggedInUserId, orgId, bodyData)
			} catch (error) {
				return responses.failureResponse({
					message: error.message || error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROJECT_CREATED_SUCCESSFULLY',
				result: { id: projectCreate.id },
			})
		} catch (error) {
			throw error
		}
	}
	/**
	 * project update
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - project update response.
	 */

	static async update(resourceId, orgId, loggedInUserId, bodyData) {
		try {
			const forbidden_resource_statuses = [
				common.RESOURCE_STATUS_PUBLISHED,
				common.RESOURCE_STATUS_REJECTED,
				common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
				common.RESOURCE_STATUS_SUBMITTED,
				common.RESOURCE_STATUS_APPROVED,
			]
			const fetchResource = await resourceQueries.findOne({
				id: resourceId,
				organization_id: orgId,
				status: {
					[Op.notIn]: forbidden_resource_statuses,
				},
			})

			if (!fetchResource) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const countReviews = await reviewsQueries.countDistinct({
				id: resourceId,
				status: [common.REVIEW_STATUS_REQUESTED_FOR_CHANGES],
				organization_id: orgId,
			})

			if (fetchResource.status === common.RESOURCE_STATUS_IN_REVIEW && countReviews > 0) {
				return responses.failureResponse({
					message: {
						key: 'FORBIDDEN_RESOURCE_UPDATE',
						interpolation: { resourceTitle: fetchResource.title, reviewer_count: countReviews },
					},
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			bodyData = _.omit(bodyData, ['review_type', 'type', 'organization_id'])

			//upload to blob
			const uploadStatus = await this.uploadToCloud(resourceId, loggedInUserId, orgId, bodyData)
			return uploadStatus
		} catch (error) {
			console.log(error, 'error')
			throw error
		}
	}
	/**
	 * project delete
	 * @method
	 * @name delete
	 * @param {Object} req.id - project id
	 * @returns {JSON} - project delete response.
	 */

	static async delete(resourceId, loggedInUserId) {
		try {
			const fetchOrgId = await resourceCreatorMappingQueries.findOne(
				{
					resource_id: resourceId,
					creator_id: loggedInUserId,
				},
				['id', 'organization_id']
			)

			let fetchResourceId = null

			if (fetchOrgId) {
				fetchResourceId = await resourceQueries.findOne(
					{
						id: resourceId,
						organization_id: fetchOrgId.organization_id,
						status: common.STATUS_DRAFT,
					},
					{ attributes: ['id'] }
				)
			}

			if (!fetchOrgId || !fetchResourceId) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let updatedProject = await resourceQueries.deleteOne(resourceId, fetchOrgId.organization_id)
			let updatedProjectCreatorMapping = await resourceCreatorMappingQueries.deleteOne(
				fetchOrgId.id,
				loggedInUserId
			)

			if (updatedProject === 0 && updatedProjectCreatorMapping === 0) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'PROJECT_DELETED_SUCCESSFUL',
				result: {},
			})
		} catch (error) {
			console.log(error, 'error')
			throw error
		}
	}
	/**
	 * Project details
	 * @method
	 * @name details
	 * @param {String} projectId - Project id
	 * @param {String} organization_id - Organization id
	 * @returns {JSON} - Project data.
	 */

	static async details(projectId, orgId, loggedInUserId) {
		try {
			let result = {
				reviewers: {},
				comments: [],
				organization: {},
			}

			const project = await resourceQueries.findOne({
				id: projectId,
				organization_id: orgId,
				type: common.PROJECT,
			})

			if (!project) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (project.status == common.STATUS_DRAFT && project.user_id !== loggedInUserId) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_VISIBLE',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//get the data from storage
			if (project.blob_path) {
				const response = await filesService.fetchJsonFromCloud(project.blob_path)
				if (
					response.statusCode === httpStatusCode.ok &&
					response.result &&
					Object.keys(response.result).length > 0
				) {
					//modify the response as label value pair
					if (Object.keys(response.result).length > 0) {
						const userDetails = {
							organization_id: orgId,
							id: loggedInUserId,
						}
						let entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
							{
								model: common.PROJECT,
								status: common.STATUS_ACTIVE,
							},
							userDetails,
							['id', 'value', 'label', 'has_entities']
						)

						if (entityTypes.length > 0) {
							const entityTypeMap = entityTypes.reduce((map, type) => {
								if (type.has_entities && type.entities) {
									map[type.value] = type.entities
										.filter((entity) => entity.status === common.ACTIVE)
										.map((entity) => ({ label: entity.label, value: entity.value.toLowerCase() }))
								}
								return map
							}, {})

							for (const entityType of entityTypes) {
								const key = entityType.value

								// Skip the entity type if entities are not available
								if (entityType.has_entities && entityType.entities && entityType.entities.length > 0) {
									if (response.result.hasOwnProperty(key)) {
										const value = response.result[key]

										// If the value is already in label-value pair format, skip processing
										if (utils.isLabelValuePair(value)) {
											continue
										}

										// get the entities
										const validEntities = entityTypeMap[key] || []

										if (Array.isArray(value)) {
											// Map each item in the array to a label-value pair, if it exists in validEntities
											response.result[key] = value.map((item) => {
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
											response.result[key] = match || { label: value, value: value.toLowerCase() }
										}
									}
								}
							}

							result = { ...result, ...response.result }
						}
					}
				}
			}

			//get organization details
			let organizationDetails = await userRequests.fetchDefaultOrgDetails(project.organization_id)
			if (organizationDetails.success && organizationDetails.data && organizationDetails.data.result) {
				project.organization = _.pick(organizationDetails.data.result, ['id', 'name', 'code'])
			}

			delete project.blob_path
			result = { ...result, ...project }

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROJECT_FETCHED_SUCCESSFULLY',
				result: result,
			})
		} catch (error) {
			console.log(error, 'error')
			throw error
		}
	}

	/**
	 * List reviewers based on Org Id
	 * @method
	 * @name reviewerList
	 * @returns {JSON} - List of reviewers from the org
	 */

	static async reviewerList(organization_id, pageNo, limit) {
		try {
			const reviewers = await userRequests.list(common.REVIEWER, pageNo, limit, '', organization_id)
			if (reviewers.success) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REVIEWER_LIST_FETCHED_SUCCESSFULLY',
					result: reviewers.data.result,
				})
			} else {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REVIEWER_LIST_FETCHED_SUCCESSFULLY',
					result: [],
				})
			}
		} catch (error) {
			throw error
		}
	}

	static async submitForReview(resourceId, bodyData, userDetails) {
		try {
			let projectDetails = await this.details(resourceId, userDetails.organization_id, userDetails.id)

			if (projectDetails.statusCode !== httpStatusCode.ok) {
				return responses.failureResponse({
					message: 'DONT_HAVE_PROJECT_ACCESS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let projectData = projectDetails.result

			if (projectData.user_id !== userDetails.id) {
				return responses.failureResponse({
					message: 'DONT_HAVE_PROJECT_ACCESS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.PROJECT,
					status: common.STATUS_ACTIVE,
				},
				userDetails,
				['id', 'value', 'has_entities', 'validations']
			)

			// Using forEach instead of for loop for entity type validations

			entityTypes.forEach((entityType) => {
				const fieldData = projectData[entityType.value]

				if (entityType.validations.required) {
					let required = utils.checkRequired(entityType, fieldData)
					if (!required) {
						throw responses.failureResponse({
							message: `${entityType.value} not added`,
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
							error: utils.errorObject(common.BODY, entityType.value),
						})
					}
				}

				if (entityType.has_entities) {
					let checkEntities = utils.checkEntities(entityType, fieldData)
					if (!checkEntities.status) {
						throw responses.failureResponse({
							message: checkEntities.message,
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
							error: utils.errorObject(common.BODY, entityType.value),
						})
					}
				}

				if (entityType.validations.regex) {
					let checkRegex = utils.checkRegexPattern(entityType, fieldData)
					if (checkRegex) {
						throw responses.failureResponse({
							message: `Special characters not allowed in ${entityType.value}`,
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
							error: utils.errorObject(common.BODY, entityType.value),
						})
					}
				}
			})

			if (projectData.tasks.length < 1) {
				throw responses.failureResponse({
					message: 'TASK_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					error: utils.errorObject(common.BODY, common.TASKS),
				})
			} else if (projectData.tasks.length > process.env.MAX_PROJECT_TASK_COUNT) {
				throw responses.failureResponse({
					message: 'EXCEEDED_PROJECT_TASK_COUNT',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
					error: utils.errorObject(common.BODY, common.TASKS),
				})
			}

			let taskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.TASKS,
					status: common.STATUS_ACTIVE,
				},
				userDetails,
				['value', 'validations']
			)
			//TODO: This dont have code for each type of validation please make sure that in future when adding new validadtion include code for that
			// Using forEach for iterating through tasks and taskEntityTypes
			projectData.tasks.forEach(async (task) => {
				taskEntityTypes.forEach(async (taskEntityType) => {
					const fieldData = task[taskEntityType.value]
					if (taskEntityType.validations.required) {
						let required = await utils.checkRequired(taskEntityType, fieldData)
						if (!required) {
							return new responses.failureResponse({
								message: `task.${taskEntityType.value} not added`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.TASKS, taskEntityType.value),
							})
						}
					}

					if (taskEntityType.has_entities) {
						let checkEntities = utils.checkEntities(taskEntityType, fieldData)
						if (!checkEntities.status) {
							throw responses.failureResponse({
								message: checkEntities.message,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.TASKS, taskEntityType.value),
							})
						}
					}

					if (taskEntityType.validations.regex) {
						let checkRegex = utils.checkRegexPattern(taskEntityType, fieldData)
						if (checkRegex) {
							throw responses.failureResponse({
								message: `Special characters not allowed in ${taskEntityType.value}`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.TASKS, taskEntityType.value),
							})
						}
					}
				})
				// TODO: Get file types from products teams and add validation for them
				if (task.allow_evidences == common.TRUE && task.evidence_details.file_types.length < 1) {
					throw responses.failureResponse({
						message: 'FILE_TYPE_NOT_SELECTED',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
						error: utils.errorObject(common.BODY, common.FILE_TYPE),
					})
				}

				if (task.learning_resources && task.learning_resources.length > 0) {
					let subTaskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
						{
							model: common.SUBTASKS,
							status: common.STATUS_ACTIVE,
						},
						userDetails,
						['value', 'validations']
					)
					task.learning_resources.forEach((learningResource) => {
						let validateURL = utils.checkRegexPattern(subTaskEntityTypes[0], learningResource.url)
						if (validateURL) {
							throw responses.failureResponse({
								message: 'INCORRECT_LEARNING_RESOURCE',
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, common.CHILDREN),
							})
						}
					})
				}
			})

			await resourceQueries.updateOne({ id: projectData.id }, { status: common.RESOURCE_STATUS_SUBMITTED })
			//TODO: For review flow this has to be changed we might need to add further conditions
			// and Validate those reviewer as well
			if (bodyData.hasOwnProperty('reviewer_ids') && bodyData.reviewer_ids.length > 0) {
				let reviewsData = bodyData.reviewer_ids.map((reviewer_id) => ({
					resource_id: projectData.id,
					reviewer_id,
					status: common.REVIEW_STATUS_NOT_STARTED,
					organization_id: userDetails.organization_id,
				}))

				await reviewsQueries.bulkCreate(reviewsData)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'PROJECT_SUBMITTED_SUCCESSFULLY',
				result: { id: projectData.id },
			})
		} catch (error) {
			return error
		}
	}

	/**
	 * Upload to cloud
	 * @method
	 * @name uploadToCloud
	 * @param {Object} req.id - project id
	 * @returns {JSON} - project delete response.
	 */

	static async uploadToCloud(resourceId, loggedInUserId, orgId, bodyData) {
		try {
			const fileName = `${loggedInUserId}${resourceId}${orgId}project.json`

			let getSignedUrl = await filesService.getSignedUrl(
				{ [resourceId]: { files: [fileName] } },
				common.PROJECT,
				loggedInUserId
			)

			const url = getSignedUrl.result[resourceId].files[0].url
			const blobPath = getSignedUrl.result[resourceId].files[0].file

			let config = {
				method: 'put',
				maxBodyLength: Infinity,
				url: url,
				headers: {
					'Content-Type': 'multipart/form-data',
				},
				data: JSON.stringify(bodyData),
			}

			let projectUploadStatus = await axios.request(config)

			if (
				projectUploadStatus.status == httpStatusCode.ok ||
				projectUploadStatus.status == httpStatusCode.created
			) {
				let filter = {
					id: resourceId,
					organization_id: orgId,
				}

				let updateData = {
					updated_by: loggedInUserId,
					blob_path: blobPath,
				}

				const [updateCount, updatedProject] = await resourceQueries.updateOne(filter, updateData, {
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

				return responses.successResponse({
					statusCode: httpStatusCode.accepted,
					message: 'PROJECT_UPDATED_SUCCESSFUL',
					result: updatedProject[0].id,
				})
			} else {
				return responses.failureResponse({
					message: 'FILE_UPLOADED_FAILED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
		} catch (error) {
			console.log(error, 'error')
			throw error
		}
	}
}

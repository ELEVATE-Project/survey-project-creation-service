const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const resourceCreatorMappingQueries = require('@database/queries/resourcesCreatorMapping')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const filesService = require('@services/files')
const userRequests = require('@requests/user')
const configService = require('@services/config')
const _ = require('lodash')
const { Op } = require('sequelize')
const reviewsQueries = require('@database/queries/reviews')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const entityTypeQueries = require('@database/queries/entityType')
const utils = require('@generics/utils')
const resourceService = require('@services/resource')

module.exports = class ProjectsHelper {
	/**
	 *  project create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - project id
	 */
	static async create(bodyData, loggedInUserId, orgId) {
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
				//create project
				projectCreate = await resourceQueries.create(projectData)
				const mappingData = {
					resource_id: projectCreate.id,
					creator_id: loggedInUserId,
					organization_id: orgId,
				}
				await resourceCreatorMappingQueries.create(mappingData)

				//upload to blob
				const resourceId = projectCreate.id
				const fileName = `${loggedInUserId}${resourceId}project.json`

				const projectUploadStatus = await resourceService.uploadToCloud(
					fileName,
					projectCreate.id,
					common.PROJECT,
					loggedInUserId,
					bodyData
				)

				if (
					projectUploadStatus.result.status == httpStatusCode.ok ||
					projectUploadStatus.result.status == httpStatusCode.created
				) {
					let filter = {
						id: resourceId,
						organization_id: orgId,
					}

					let updateData = {
						updated_by: loggedInUserId,
						blob_path: projectUploadStatus.blob_path,
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

	static async update(resourceId, bodyData, loggedInUserId, orgId) {
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

			bodyData = _.omit(bodyData, ['review_type', 'type', 'organization_id', 'user_id'])

			//upload to blob
			const fileName = `${loggedInUserId}${resourceId}project.json`
			const projectUploadStatus = await resourceService.uploadToCloud(
				fileName,
				resourceId,
				common.PROJECT,
				loggedInUserId,
				bodyData
			)
			if (
				projectUploadStatus.result.status == httpStatusCode.ok ||
				projectUploadStatus.result.status == httpStatusCode.created
			) {
				let filter = {
					id: resourceId,
					organization_id: orgId,
				}

				let updateData = {
					updated_by: loggedInUserId,
					blob_path: projectUploadStatus.blob_path,
				}
				if (bodyData['title'] != '') {
					updateData.title = bodyData['title']
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
				throw new Error('FILE_UPLOADED_FAILED')
			}
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
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
				organization: {},
			}

			const project = await resourceQueries.findOne(
				{
					id: projectId,
					organization_id: orgId,
					type: common.PROJECT,
				},
				{ attributes: { exclude: ['next_stage', 'review_type', 'published_id', 'reference_id'] } }
			)

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
					let resultData = response.result

					//get all entity types with entities
					let entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
						{
							model: common.PROJECT,
							status: common.STATUS_ACTIVE,
						},
						orgId,
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

						for (let entityType of entityTypes) {
							const key = entityType.value
							// Skip the entity type if entities are not available
							if (
								entityType.has_entities &&
								entityType.entities &&
								entityType.entities.length > 0 &&
								resultData.hasOwnProperty(key)
							) {
								const value = resultData[key]
								// If the value is already in label-value pair format, skip processing
								if (utils.isLabelValuePair(value) || value === '') {
									continue
								}

								// get the entities
								const validEntities = entityTypeMap[key] || []

								if (Array.isArray(value)) {
									// Map each item in the array to a label-value pair, if it exists in validEntities
									resultData[key] = value.map((item) => {
										const match = validEntities.find(
											(entity) => entity.value === item.toLowerCase()
										)
										return match || { label: item, value: item.toLowerCase() }
									})
								} else {
									// If the value is a single item, find it in validEntities
									const match = validEntities.find((entity) => entity.value === value.toLowerCase())
									resultData[key] = match || { label: value, value: value.toLowerCase() }
								}
							}
						}

						result = { ...result, ...resultData }
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
			throw error
		}
	}

	/**
	 * List reviewers based on Org Id
	 * @method
	 * @name reviewerList
	 * @returns {JSON} - List of reviewers from the org
	 */

	static async reviewerList(user_id, organization_id, pageNo, limit) {
		try {
			let reviewers = await userRequests.list(common.REVIEWER, pageNo, limit, '', organization_id, {
				excluded_user_ids: [user_id],
			})
			let userList = []

			if (reviewers.success) {
				if (reviewers.data.result.data.length > 0) {
					userList = reviewers.data.result.data.filter((user) => user.id !== user_id)
				}
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REVIEWER_LIST_FETCHED_SUCCESSFULLY',
					result: {
						data: userList,
						count: reviewers.data.result.count,
					},
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
				})
			}

			if (projectData.status === common.RESOURCE_STATUS_SUBMITTED) {
				return responses.failureResponse({
					message: 'RESOURCE_ALREADY_SUBMITTED',
				})
			}

			if (projectData?.notes?.length > process.env.MAX_RESOURCE_NOTE_LENGTH) {
				return responses.failureResponse({
					message: 'RESOURCE_NOTE_LENGTH_EXCEEDED',
				})
			}

			let entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.PROJECT,
					status: common.STATUS_ACTIVE,
				},
				userDetails.organization_id,
				['id', 'value', 'has_entities', 'validations']
			)
			const subTaskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.SUBTASKS,
					status: common.STATUS_ACTIVE,
				},
				userDetails.organization_id,
				['value', 'validations']
			)
			const subTaskEntityTypesMapping = subTaskEntityTypes.reduce((acc, item) => {
				acc[item.value] = item
				return acc
			}, {})

			const allowedFileTypesEntityTypes = await entityTypeQueries.findUserEntityTypeAndEntities(
				{
					value: common.TASK_ALLOWED_FILE_TYPES,
					status: common.STATUS_ACTIVE,
				},
				userDetails,
				['id', 'value', 'has_entities', 'validations']
			)

			const allowedFileTypesEntities = allowedFileTypesEntityTypes[0].entities.map((item) => {
				return item.value
			})

			for (let entityType of entityTypes) {
				let fieldData = projectData[entityType.value]

				if (entityType.validations.required) {
					let required = utils.checkRequired(entityType, fieldData)
					if (!required) {
						throw {
							error: utils.errorObject(common.BODY, entityType.value, `${entityType.value} not added`),
						}
					}
				}

				if (Object.keys(entityType.validations).includes('max_length')) {
					let max_text_length = entityType.validations.max_length
					let checkLength = utils.compareLength(max_text_length, fieldData.length)
					if (checkLength > 0) {
						throw {
							error: utils.errorObject(
								common.BODY,
								entityType.value,
								`Max length value exceeded for project ${entityType.value}`
							),
						}
					}
				}

				if (entityType.has_entities) {
					let checkEntities = utils.checkEntities(entityType, fieldData)
					if (!checkEntities.status) {
						throw {
							message: checkEntities.message,
							error: utils.errorObject(common.BODY, entityType.value),
						}
					}
				}

				if (entityType.validations.regex) {
					if (entityType.value === common.LEARNING_RESOURCE) {
						let learning = await this.validate_learning_resources(
							fieldData,
							subTaskEntityTypesMapping['name'],
							subTaskEntityTypesMapping['learning_resources'],
							common.BODY
						)
						if (learning.errorFlag) {
							throw {
								error: learning.error,
							}
						}
					} else {
						let checkRegex = utils.checkRegexPattern(entityType, fieldData)
						if (checkRegex) {
							throw {
								error: utils.errorObject(
									common.BODY,
									entityType.value,
									`Special characters not allowed in ${entityType.value}`
								),
							}
						}
					}
				}
			}

			if (projectData?.tasks.length <= 0 || !projectData?.tasks) {
				throw {
					error: utils.errorObject(common.BODY, common.TASKS, 'Task not found'),
				}
			} else if (projectData.tasks.length > process.env.MAX_PROJECT_TASK_COUNT) {
				throw {
					error: utils.errorObject(common.BODY, common.TASKS, 'Project task has exceeded the max count'),
				}
			}

			let taskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.TASKS,
					status: common.STATUS_ACTIVE,
				},
				userDetails.organization_id,
				['id', 'value', 'validations', 'has_entities']
			)

			//TODO: This dont have code for each type of validation please make sure that in future
			//when adding new validadtion include code for that
			// Using forEach for iterating through tasks and taskEntityTypes

			for (let task of projectData.tasks) {
				let fieldData
				for (let taskEntityType of taskEntityTypes) {
					if (taskEntityType.value === common.FILE_TYPE) {
						fieldData = task.evidence_details[taskEntityType.value]
					} else {
						fieldData = task[taskEntityType.value]
					}

					if (taskEntityType.validations.required) {
						let required = await utils.checkRequired(taskEntityType, fieldData)
						if (!required) {
							throw {
								error: utils.errorObject(
									common.TASKS,
									taskEntityType.value,
									`task.${taskEntityType.value} not added`
								),
							}
						}
					}

					if (taskEntityType.has_entities) {
						let checkEntities = utils.checkEntities(taskEntityType, fieldData)

						if (!checkEntities.status) {
							throw {
								error: utils.errorObject(common.TASKS, taskEntityType.value, checkEntities.message),
							}
						}
					}

					if (taskEntityType.validations.regex) {
						let checkRegex = utils.checkRegexPattern(taskEntityType, fieldData)
						if (checkRegex) {
							throw {
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(
									common.TASKS,
									taskEntityType.value,
									`Special characters not allowed in ${taskEntityType.value}`
								),
							}
						}
					}
				}
				// TODO: Get file types from products teams and add validation for them
				if (task.allow_evidences == common.TRUE && task.evidence_details.file_types.length < 1) {
					throw {
						error: utils.errorObject(common.BODY, common.FILE_TYPE, 'File type not selected'),
					}
				} else if (task.allow_evidences == common.TRUE && task.evidence_details.file_types.length > 0) {
					let difference = _.difference(task.evidence_details.file_types, allowedFileTypesEntities)

					if (difference.length > 0) {
						throw {
							error: utils.errorObject(common.TASK_EVIDENCE, common.FILE_TYPE, 'Invalid file type'),
						}
					}
				}

				if (task.learning_resources && task.learning_resources.length > 0) {
					let learning = await this.validate_learning_resources(
						task.learning_resources,
						subTaskEntityTypesMapping['name'],
						subTaskEntityTypesMapping['learning_resources'],
						common.TASKS
					)
					if (learning.errorFlag) {
						throw {
							error: learning.error,
						}
					}
				}
			}

			await resourceQueries.updateOne({ id: projectData.id }, { status: common.RESOURCE_STATUS_SUBMITTED })
			//TODO: For review flow this has to be changed we might need to add further conditions
			// and Validate those reviewer as well
			if (bodyData.reviewer_ids && bodyData.reviewer_ids.length > 0) {
				const orgReviewers = await userRequests.list(common.REVIEWER, '', '', '', userDetails.organization_id, {
					user_ids: bodyData.reviewer_ids,
					excluded_user_ids: [userDetails.id],
				})
				let orgReviewerIds = []
				if (orgReviewers.success && orgReviewers.data.result.data.length > 0) {
					orgReviewerIds = orgReviewers.data.result.data.map((item) => item.id)
				}
				if (orgReviewerIds.length <= 0) {
					throw {
						message: 'REVIEWER_IDS_NOT_FOUND',
					}
				}

				let filteredReviewerIds = bodyData.reviewer_ids.filter((id) => orgReviewerIds.includes(id))

				let reviewsData = filteredReviewerIds.map((reviewer_id) => ({
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
			return responses.failureResponse({
				message: 'RESOURCE_VALIDATION_FAILED',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
				result: error.error || [],
			})
		}
	}
	static async validate_learning_resources(fieldData, name_validation_entityType, url_validation_entity_type, field) {
		for (let learningResource of fieldData) {
			let validateName = utils.checkRegexPattern(name_validation_entityType, learningResource.name)
			if (validateName) {
				return {
					errorFlag: true,
					error: utils.errorObject(field, common.LEARNING_RESOURCE, 'Incorrect learning resource name'),
				}
			}

			let validateURL = utils.checkRegexPattern(url_validation_entity_type, learningResource.url)
			if (validateURL) {
				return {
					errorFlag: true,
					error: utils.errorObject(field, common.LEARNING_RESOURCE, 'Incorrect learning resource URL'),
				}
			}
		}
		return {
			errorFlag: false,
			error: [],
		}
	}
}

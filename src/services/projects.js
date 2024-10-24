const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const resourceCreatorMappingQueries = require('@database/queries/resourcesCreatorMapping')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const filesService = require('@services/files')
const userRequests = require('@requests/user')
const orgExtensionService = require('@services/organization-extension')
const _ = require('lodash')
const { Op } = require('sequelize')
const reviewsQueries = require('@database/queries/reviews')
const reviewsResourcesQueries = require('@database/queries/reviewsResources')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const utils = require('@generics/utils')
const resourceService = require('@services/resource')
const reviewService = require('@services/reviews')
const commentQueries = require('@database/queries/comments')
module.exports = class ProjectsHelper {
	/**
	 *  project create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - project id
	 */
	static async create(bodyData, loggedInUserId, orgId, reference_id = null) {
		try {
			if (reference_id) {
				// check if the reference project Id is valid or not
				const referenceProject = await resourceQueries.findOne(
					{
						id: reference_id,
						status: common.RESOURCE_STATUS_PUBLISHED,
						stage: common.RESOURCE_STAGE_COMPLETION,
					},
					{
						attributes: ['type'],
					}
				)

				if (!referenceProject || referenceProject.type != common.PROJECT) {
					return responses.failureResponse({
						message: 'PROJECT_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
			}

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

			let projectData = {
				title: bodyData.title,
				type: common.PROJECT,
				status: common.RESOURCE_STATUS_DRAFT,
				stage: common.RESOURCE_STAGE_CREATION,
				user_id: loggedInUserId,
				review_type: orgConfigList[common.PROJECT],
				organization_id: orgId,
				meta: {},
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
			}

			if (reference_id) projectData.reference_id = reference_id

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

				// upload to blob
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
			//validate the title length
			const isTitleInvalid = utils.validateTitle(bodyData.title)
			if (isTitleInvalid) {
				return responses.failureResponse({
					message: 'CHARACTER_LIMIT_EXCEED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const forbidden_resource_statuses = [
				common.RESOURCE_STATUS_PUBLISHED,
				common.RESOURCE_STATUS_REJECTED,
				common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
				common.RESOURCE_STATUS_SUBMITTED,
				common.REVIEW_STATUS_INPROGRESS,
			]
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

			if (!fetchResource?.id) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const countReviews = await reviewsQueries.distinctResources(
				{
					organization_id: orgId,
					resource_id: resourceId,
					status: [common.REVIEW_STATUS_REQUESTED_FOR_CHANGES],
				},
				['resource_id']
			)
			// fetchResource.stage === common.RESOURCE_STATUS_IN_REVIEW
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

				//update is_under_edit true if reviewer requested for changes
				if (countReviews.count > 0) {
					updateData.is_under_edit = true
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
					message:
						// fetchResource.status == common.RESOURCE_STATUS_IN_REVIEW
						fetchResource.stage == common.RESOURCE_STAGE_REVIEW
							? 'PROJECT_SAVED_SUCCESSFULLY'
							: 'PROJECT_UPDATED_SUCCESSFUL',
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
			const resourceCreatorMapping = await resourceCreatorMappingQueries.findOne(
				{
					resource_id: resourceId,
					creator_id: loggedInUserId,
				},
				['id', 'organization_id']
			)

			if (!resourceCreatorMapping?.id) {
				throw new Error('PROJECT_NOT_FOUND')
			}

			const resource = await resourceQueries.findOne(
				{
					id: resourceId,
					organization_id: resourceCreatorMapping.organization_id,
					status: common.RESOURCE_STATUS_DRAFT,
					stage: common.RESOURCE_STAGE_CREATION,
				},
				{ attributes: ['id', 'type', 'organization_id'] }
			)

			if (!resource?.id) {
				throw new Error('PROJECT_NOT_FOUND')
			}

			let updatedProject = await resourceQueries.deleteOne(resourceId, resource.organization_id)
			let updatedProjectCreatorMapping = await resourceCreatorMappingQueries.deleteOne(
				resourceCreatorMapping.id,
				loggedInUserId
			)

			if (updatedProject === 0 && updatedProjectCreatorMapping === 0) {
				throw new Error('PROJECT_NOT_FOUND')
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'PROJECT_DELETED_SUCCESSFUL',
				result: {},
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
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

	static async details(projectId, orgId) {
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
				{ attributes: { exclude: ['next_stage', 'review_type'] } }
			)

			if (!project) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
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
							model: common.ENTITY_TYPE_MODELS[common.PROJECT],
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

						await Promise.all(
							entityTypes.map(async (entityType) => {
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
										return
									}

									// Get the entities
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
										const match = validEntities.find(
											(entity) => entity.value === value.toLowerCase()
										)
										resultData[key] = match || { label: value, value: value.toLowerCase() }
									}
								}
							})
						)

						result = { ...result, ...resultData }
					}
				}
			}

			//get organization details
			let organizationDetails = await userRequests.fetchOrg(project.organization_id)
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
			let result = {
				data: [],
				count: 0,
			}

			let reviewers = await userRequests.list(common.REVIEWER, pageNo, limit, '', organization_id, {
				excluded_user_ids: [user_id],
			})

			let userList = []

			if (!reviewers.success) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REVIEWER_LIST_FETCHED_SUCCESSFULLY',
					result,
				})
			}

			//written as a beckup will remove once the user service PR merged
			if (Array.isArray(reviewers?.data?.result?.data) && reviewers.data.result.data.length > 0) {
				userList = reviewers.data.result.data.filter((user) => user.id != user_id)
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEWER_LIST_FETCHED_SUCCESSFULLY',
				result: {
					data: userList,
					count: userList.length,
				},
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Submit the project for review
	 * @method
	 * @name submitForReview
	 * @returns {JSON} - Response status of the submission
	 */
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

			//check the creator is valid
			if (projectData.user_id !== userDetails.id) {
				return responses.failureResponse({
					message: 'DONT_HAVE_PROJECT_ACCESS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//Restrict the user to submit the project
			if (_nonReviewableResourceStatuses.includes(projectData.status)) {
				throw new Error(`Resource is already ${projectData.status}. You can't submit it`)
			}

			// check any open comments are there for this resource
			const comments = await commentQueries.findAndCountAll({
				user_id: {
					[Op.notIn]: [userDetails.id],
				},
				resource_id: resourceId,
				status: common.COMMENT_STATUS_OPEN,
			})

			if (comments.count > 0) {
				return responses.failureResponse({
					message: 'ALL_COMMENTS_NOT_RESOLVED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let validationErrors = []

			//validate number of task
			if (projectData.tasks?.length > parseInt(process.env.MAX_PROJECT_TASK_COUNT, 10)) {
				throw {
					error: utils.errorObject(
						common.TASKS,
						'',
						'Project task count has exceeded the maximum allowed limit'
					),
				}
			}

			// Check that the note character limit does not exceed the maximum limit
			if (bodyData?.notes?.length > process.env.MAX_RESOURCE_NOTE_LENGTH) {
				return responses.failureResponse({
					message: 'RESOURCE_NOTE_LENGTH_EXCEEDED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//validate the reviewer
			let reviewerIds = []
			if (bodyData.reviewer_ids && bodyData.reviewer_ids.length > 0) {
				const uniqueReviewerIds = utils.getUniqueElements(bodyData.reviewer_ids)
				const reviewers = await userRequests.list(common.REVIEWER, '', '', '', userDetails.organization_id, {
					user_ids: uniqueReviewerIds,
					excluded_user_ids: [userDetails.id],
				})

				if (!reviewers.success) throw new Error('REVIEWER_IDS_NOT_FOUND')

				//written as a backup will remove once the user service PR merged
				if (Array.isArray(reviewers?.data?.result?.data) && reviewers.data.result.data.length > 0) {
					reviewerIds = reviewers.data.result.data.map((item) => item.id)
				} else {
					// If no valid reviewers data is found, return an error response
					throw new Error('REVIEWER_IDS_NOT_FOUND')
				}

				//return error message if the reviewer is invalid or not found
				if (uniqueReviewerIds.length > reviewers.data.result.data.length) {
					throw new Error('REVIEWER_IDS_NOT_FOUND')
				}
			}

			//get all entity type validations for project
			let entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.PROJECT,
					status: common.STATUS_ACTIVE,
				},
				projectData.organization_id,
				['id', 'value', 'has_entities', 'validations']
			)

			//fetch task entityType validations
			let taskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.TASKS,
					status: common.STATUS_ACTIVE,
				},
				projectData.organization_id,
				['id', 'value', 'validations', 'has_entities']
			)

			const taskEntityTypesMapping = taskEntityTypes.reduce((acc, item) => {
				acc[item.value] = item
				return acc
			}, {})

			let basePath = ''
			//validate project data
			const projectValidationPromises = entityTypes.map((entityType) =>
				this.validateEntityData(projectData, entityType, common.PROJECT, basePath, taskEntityTypesMapping)
			)
			const projectValidationResults = await Promise.all(projectValidationPromises)
			for (const validationResult of projectValidationResults) {
				if (validationResult.hasError) {
					validationErrors.push(validationResult.error)
				}
			}

			//get all entity type validations for task
			const subTaskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.SUBTASKS,
					status: common.STATUS_ACTIVE,
				},
				projectData.organization_id,
				['value', 'validations']
			)

			// validation for task is not empty
			if (projectData?.tasks?.length > 0) {
				// validate task
				await Promise.all(
					projectData.tasks.map(async (task) => {
						// Validate task entities
						await Promise.all(
							taskEntityTypes.map(async (taskEntityType) => {
								let validationResult = await this.validateEntityData(
									task,
									taskEntityType,
									common.TASKS,
									common.BODY,
									taskEntityTypesMapping
								)
								if (validationResult.hasError) {
									validationErrors.push(validationResult.error)
								}
							})
						)

						// Validate child tasks if they exist
						if (task.children && task.children.length > 0) {
							await Promise.all(
								task.children.map(async (childTask) => {
									await Promise.all(
										subTaskEntityTypes.map(async (subTaskEntityType) => {
											let validationResult = await this.validateEntityData(
												childTask,
												subTaskEntityType,
												common.SUB_TASK,
												subTaskEntityType.id,
												taskEntityTypesMapping
											)

											if (validationResult.hasError) {
												validationErrors.push(validationResult.error)
											}
										})
									)
								})
							)
						}
					})
				)
			}

			console.log(validationErrors, 'validationErrors')
			if (validationErrors.length > 0) {
				const result = Array.isArray(validationErrors) ? validationErrors.flat() : validationErrors || []
				return responses.failureResponse({
					responseCode: 'CLIENT_ERROR',
					statusCode: httpStatusCode.bad_request,
					result: result,
					message: 'RESOURCE_VALIDATION_FAILED',
				})
			}

			//create the review entry
			if (reviewerIds.length > 0) {
				//create entry in reviews table
				let reviewsData = reviewerIds.map((reviewer_id) => ({
					resource_id: projectData.id,
					reviewer_id,
					status: common.REVIEW_STATUS_NOT_STARTED,
					organization_id: userDetails.organization_id,
				}))

				await reviewsQueries.bulkCreate(reviewsData)
				delete reviewsData.status
				await reviewsResourcesQueries.bulkCreate(reviewsData)
			}

			//update the reviews and resource status
			let resourceStatus = common.RESOURCE_STATUS_SUBMITTED
			if (
				// projectData.status === common.RESOURCE_STATUS_IN_REVIEW ||
				projectData.stage === common.RESOURCE_STAGE_REVIEW ||
				projectData.status === common.RESOURCE_STATUS_SUBMITTED
			) {
				//Update the review status if the resource has been submitted before
				await reviewsQueries.update(
					{
						organization_id: projectData.organization_id,
						resource_id: projectData.id,
						status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
					},
					{
						status: common.REVIEW_STATUS_CHANGES_UPDATED,
					}
				)
			}

			//check review is required or not
			const isReviewMandatory = await resourceService.isReviewMandatory(
				projectData.type,
				projectData.organization_id
			)
			if (!isReviewMandatory) {
				const publishResource = await reviewService.publishResource(
					resourceId,
					projectData.user_id,
					projectData.organization_id
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

			if (bodyData.notes) {
				resourcesUpdate.meta = {
					notes: bodyData.notes,
				}
			}

			await resourceQueries.updateOne({ id: projectData.id }, resourcesUpdate)
			//add user action
			eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
				actionCode: common.USER_ACTIONS[projectData.type].RESOURCE_SUBMITTED,
				userId: userDetails.id,
				objectId: resourceId,
				objectType: common.MODEL_NAMES.RESOURCE,
				orgId: userDetails.organization_id,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROJECT_SUBMITTED_SUCCESSFULLY',
				result: { id: projectData.id },
			})
		} catch (error) {
			console.log(error, 'error ')
			return responses.failureResponse({
				message: error.message || 'RESOURCE_VALIDATION_FAILED',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
				result: error.error || [],
			})
		}
	}

	/**
	 * Validates the given project data
	 * @method
	 * @name validateEntityData
	 * @param {Object} entityData - Data which needs to validate
	 * @param {Object} entityType - Each entityType which have models
	 * @param {string} model - The model needs to validate ex: project, tasks, subTasks
	 * @param {string} sourceType - Specifies the source of the input, which can be 'body', 'param', or 'query'.
	 * @returns {JSON} - Response containing error details, if any.
	 */
	static async validateEntityData(entityData, entityType, model, sourceType, entityMapping) {
		try {
			let dynamicPath = sourceType ? `${sourceType}` : entityType.value
			let keyPaths = findKeyPath(entityData, entityType.value, '', [])

			let fieldData = entityData[entityType.value]
			if (model == common.TASKS && entityData.allow_evidences == common.TRUE) {
				// Check if file types are selected
				if (!entityData?.evidence_details?.file_types.length) {
					return {
						hasError: true,
						error: utils.errorObject(common.TASKS, common.FILE_TYPE, 'File type not selected'),
					}
				}

				if (entityType.value === common.FILE_TYPE || entityType.value === common.MIN_NO_OF_EVIDENCES) {
					fieldData = entityData.evidence_details[entityType.value]
				}
			}

			// Check if the field is required
			let requiredValidation = entityType.validations.find(
				(validation) => validation.type == common.REQUIRED_VALIDATION
			)
			if (requiredValidation) {
				let required = utils.checkRequired(requiredValidation, fieldData)
				if (!required) {
					return {
						hasError: true,
						error: utils.errorObject(
							model == common.PROJECT ? entityType.value : sourceType,
							model == common.PROJECT ? '' : model == common.TASKS ? fieldData : entityType.value,
							requiredValidation.message || `${entityType.value} is required`
						),
					}
				}
			}

			//length check validation
			let maxLengthValidation = entityType.validations.find(
				(validation) => validation.type == common.MAX_LENGTH_VALIDATION
			)
			if (maxLengthValidation) {
				let lengthCheck = utils.checkLength(maxLengthValidation, fieldData)
				if (!lengthCheck) {
					return {
						hasError: true,
						error: utils.errorObject(
							model == common.PROJECT ? entityType.value : sourceType,
							model == common.PROJECT ? '' : model == common.TASKS ? fieldData : entityType.value,
							maxLengthValidation.message || `${entityType.value} is required`
						),
					}
				}
			}

			// Check if the entity has sub-entities
			if (entityType.has_entities) {
				let checkEntities = utils.checkEntities(entityType, fieldData)
				if (!checkEntities.status) {
					return {
						hasError: true,
						error: utils.errorObject(sourceType, entityType.value, checkEntities.message),
					}
				}
			}

			// // Check regex pattern will check max length and special characters
			let regexValidation = entityType.validations.find(
				(validation) => validation.type == common.REGEX_VALIDATION
			)
			if (regexValidation && fieldData) {
				//validate learning resource validation
				if (entityType.value === common.LEARNING_RESOURCE) {
					for (let i = 0; i < fieldData.length; i++) {
						let eachResource = fieldData[i]
						let currentPath = `${dynamicPath}[${i}]`
						//validate the name and url is there
						if (!eachResource.name) {
							return {
								hasError: true,
								error: utils.errorObject(
									currentPath || sourceType,
									'name',
									regexValidation.message || `Required learning resource name and url in ${model}`
								),
							}
						}

						if (!eachResource.url) {
							return {
								hasError: true,
								error: utils.errorObject(
									currentPath || sourceType,
									'url',
									regexValidation.message || `Required learning resource name and url in ${model}`
								),
							}
						}

						//validate the name
						let validateName = utils.checkRegexPattern(entityMapping[common.NAME], eachResource.name)
						if (!validateName) {
							return {
								hasError: true,
								error: utils.errorObject(
									sourceType,
									common.LEARNING_RESOURCE,
									regexValidation.message || `Invalid learning resource name in ${model}`
								),
							}
						}
						//validate the url
						let validateURL = utils.checkRegexPattern(
							entityMapping[common.LEARNING_RESOURCE],
							eachResource.url
						)
						if (validateURL) {
							return {
								hasError: true,
								error: utils.errorObject(
									sourceType,
									common.LEARNING_RESOURCE,
									regexValidation.message || `Invalid learning resource URL in ${model}`
								),
							}
						}
					}
				} else if (
					entityType.value === common.SOLUTION_DETAILS &&
					fieldData &&
					Object.keys(fieldData).length > 0 &&
					JSON.parse(process.env.ENABLE_OBSERVATION_IN_PROJECTS)
				) {
					//validate the observation name
					let checkRegex = utils.checkRegexPattern(entityType, fieldData.name)
					if (!checkRegex) {
						return {
							hasError: true,
							error: utils.errorObject(
								sourceType,
								entityType.value,
								regexValidation.message ||
									`Solution Details ${entityType.value} is invalid, please ensure it contains no special characters and does not exceed the character limit`
							),
						}
					}
					//validate the observation url
					let regex = new RegExp(process.env.OBSERVATION_DEEP_LINK_REGEX)
					let validateURL = regex.test(fieldData.link)
					if (!validateURL) {
						return {
							hasError: true,
							error: utils.errorObject(
								sourceType,
								entityType.value,
								regexValidation.message || `Invalid observation URL in ${model}`
							),
						}
					}
				} else {
					let checkRegex = utils.checkRegexPattern(entityType, fieldData)
					if (!checkRegex) {
						return {
							hasError: true,
							error: utils.errorObject(
								model == common.PROJECT ? entityType.value : sourceType,
								model == common.PROJECT ? '' : model == common.TASKS ? fieldData : entityType.value,
								regexValidation.message ||
									`${entityType.value} can only include alphanumeric characters with spaces, -, _, &, <>`
								// `${model} ${entityType.value} is invalid, please ensure it contains no special characters and does not exceed the character limit`
							),
						}
					}
				}
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
}

function findKeyPath(obj, keyToFind, currentPath = '', paths = []) {
	// Iterate over each key in the object
	for (let key in obj) {
		if (!obj.hasOwnProperty(key)) continue

		// Construct the new path
		let newPath = currentPath ? `${currentPath}.${key}` : key

		// If the key is found, add the current path to the result
		if (key === keyToFind) {
			paths.push(newPath)
		}

		// If the value is an object, recursively search it
		if (typeof obj[key] === 'object' && obj[key] !== null) {
			findKeyPath(obj[key], keyToFind, newPath, paths)
		}
	}

	return paths
}

// function findKeyPath(obj, keyToFind, currentPath = '', results = []) {
// 	// Check if the current object is an array
// 	if (Array.isArray(obj)) {
// 		for (let i = 0; i < obj.length; i++) {
// 			findKeyPath(obj[i], keyToFind, `${currentPath}[${i}]`, results)
// 		}
// 	}
// 	// Check if the current object is an object
// 	else if (typeof obj === 'object' && obj !== null) {
// 		for (const key in obj) {
// 			// Build the new path
// 			const newPath = currentPath ? `${currentPath}.${key}` : key

// 			// Check if the current key matches the key to find
// 			if (key === keyToFind) {
// 				results.push(newPath)
// 			}

// 			// Recur for nested objects or arrays
// 			findKeyPath(obj[key], keyToFind, newPath, results)
// 		}
// 	}

// 	return results
// }

/**
 * List of resource statuses that prevent a reviewer from starting a review.
 * @constant
 * @type {Array<String>}
 */
const _nonReviewableResourceStatuses = [
	common.RESOURCE_STATUS_REJECTED,
	common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
	common.RESOURCE_STATUS_PUBLISHED,
	common.RESOURCE_STATUS_SUBMITTED,
	common.REVIEW_STATUS_CHANGES_UPDATED,
	common.REVIEW_STATUS_INPROGRESS,
]

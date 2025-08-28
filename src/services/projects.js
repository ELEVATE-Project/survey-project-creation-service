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
const certificateBasetemplateQueries = require('@database/queries/certificateBaseTemplate')
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
	static async create(bodyData, loggedInUserId, orgCode, tenantCode, reference_id = null) {
		try {
			if (reference_id) {
				// check if the reference project Id is valid or not
				const referenceProject = await resourceQueries.findOne(
					{
						id: reference_id,
						status: common.RESOURCE_STATUS_PUBLISHED,
						stage: common.RESOURCE_STAGE_COMPLETION,
						organization_code: orgCode,
						tenant_code: tenantCode,
						type: common.PROJECT,
					},
					{
						attributes: ['id'],
					}
				)

				if (!referenceProject?.id) {
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

			const orgConfig = await orgExtensionService.getConfig(orgCode, tenantCode)
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
				organization_code: orgCode,
				tenant_code: tenantCode,
				reference_id: reference_id ? reference_id : null,
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
					organization_code: orgCode,
					tenant_code: tenantCode,
				}
				await resourceCreatorMappingQueries.create(mappingData)

				// upload to blob
				const resourceId = projectCreate.id

				const projectUploadStatus = await resourceService.uploadToCloud(
					common.PROJECT_UPLOAD_FILE_NAME,
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
						organization_code: orgCode,
						tenant_code: tenantCode,
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
	 * @param {String} resourceId - resourceId.
	 * @param {Object} bodyData- reqData
	 * @param {String} loggedInUserId - loggedInUserId.
	 * @param {String} orgCode - orgCode.
	 * @param {String} tenantCode - tenantCode.
	 * @returns {JSON} - project update response.
	 **/

	static async update(resourceId, bodyData, loggedInUserId, orgCode, tenantCode) {
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
				organization_code: orgCode,
				tenant_code: tenantCode,
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

			bodyData = _.omit(bodyData, ['review_type', 'type', 'organization_code', 'user_id'])
			//upload to blob
			const projectUploadStatus = await resourceService.uploadToCloud(
				common.PROJECT_UPLOAD_FILE_NAME,
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
					organization_code: orgCode,
					tenant_code: tenantCode,
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

	static async delete(resourceId, loggedInUserId, organizationCode, tenantCode) {
		try {
			const resourceCreatorMapping = await resourceCreatorMappingQueries.findOne(
				{
					resource_id: resourceId,
					creator_id: loggedInUserId,
					organization_code: organizationCode,
					tenant_code: tenantCode,
				},
				['id', 'organization_code'],
				{
					resourceAttributes: ['id', 'type', 'organization_code'],
				}
			)

			if (!resourceCreatorMapping?.id) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const resource = {
				id: resourceCreatorMapping.resource.id,
				type: resourceCreatorMapping.resource.type,
				organization_code: resourceCreatorMapping.resource.organization_code,
			}

			if (!resource?.id && resource.type !== common.PROJECT) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let updatedProjectCreatorMapping = await resourceCreatorMappingQueries.deleteOne(
				resourceCreatorMapping.id,
				loggedInUserId
			)
			let updatedProject = await resourceQueries.deleteOne(resourceId, organizationCode, tenantCode)

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
	 * @param {String} orgCode - Project id
	 * @param {String} tenantCode - Project id
	 * @returns {JSON} - Project data.
	 */

	static async details(projectId, orgCode, tenantCode, userId, commentsOptions = {}) {
		try {
			let result = {
				organization: {},
			}

			let options = {
				attributes: { exclude: ['next_stage', 'review_type'] },
			}
			if (commentsOptions && Object.keys(commentsOptions).length > 0) {
				if (commentsOptions.commentsAttributes && commentsOptions.commentsAttributes.length > 0) {
					options.commentsAttributes = commentsOptions.commentsAttributes
				}
				if (commentsOptions.filter && Object.keys(commentsOptions.filter).length > 0) {
					options.commentsFilter = commentsOptions.filter
				}
			}

			const project = await resourceQueries.findOne(
				{
					id: projectId,
					type: common.PROJECT,
					organization_code: orgCode,
					tenant_code: tenantCode,
					created_by: userId,
				},
				options
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
						project.organization_code,
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
									entityType.entities &&
									entityType.entities.length > 0 &&
									resultData.hasOwnProperty(key) &&
									entityType.value != common.DURATION
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
			//Add path in getDownloadUrl
			if (
				result.certificate &&
				result.certificate.base_template_url &&
				typeof result.certificate.base_template_url === common.OBJECT
			) {
				let getResourceCertificateurl = result.certificate.base_template_url
				let certificatesUrl = await filesService.getDownloadableUrl([getResourceCertificateurl.filePath])

				if (
					certificatesUrl?.statusCode === httpStatusCode.ok &&
					certificatesUrl.result &&
					certificatesUrl.result.length > 0
				) {
					result.certificate.base_template_url.url = certificatesUrl.result?.[0]?.url
				}
			}
			//get organization details
			let organizationDetails = await userRequests.fetchOrg(project.organization_code, project.tenant_code)
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
	 * Submit the project for review
	 * @method
	 * @name submitForReview
	 * @returns {JSON} - Response status of the submission
	 */
	static async submitForReview(resourceId, bodyData, userDetails) {
		try {
			const commentsOptions = {
				commentsAttributes: ['id'],
				filter: {
					user_id: {
						[Op.notIn]: [userDetails.id],
					},
					status: common.COMMENT_STATUS_OPEN,
				},
			}
			let projectDetails = await this.details(
				resourceId,
				userDetails.organization_code,
				userDetails.tenant_code,
				userDetails.id,
				commentsOptions
			)
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
			const comments = projectData?.comments || []

			if (comments && comments.length > 0) {
				return responses.failureResponse({
					message: 'ALL_COMMENTS_NOT_RESOLVED',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let validationErrors = []

			//validate number of task
			if (projectData.tasks?.length > parseInt(process.env.MAX_PROJECT_TASK_COUNT, 10)) {
				validationErrors.push(
					utils.errorObject(common.TASKS, '', 'Project task count has exceeded the maximum allowed limit')
				)
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
					model: {
						[Op.in]: [common.PROJECT],
					},
					status: common.STATUS_ACTIVE,
				},
				projectData.organization_code,
				projectData.tenant_code,
				['id', 'value', 'has_entities', 'validations']
			)

			//fetch task entityType validations
			let taskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.TASKS,
					status: common.STATUS_ACTIVE,
				},
				projectData.organization_code,
				projectData.tenant_code,
				['id', 'value', 'validations', 'has_entities']
			)

			const taskEntityTypesMapping = taskEntityTypes.reduce((acc, item) => {
				acc[item.value] = item
				return acc
			}, {})

			let basePath = ''
			//validate project data
			const projectValidationPromises = entityTypes.map((entityType) =>
				this.validateEntityData(
					projectData,
					entityType,
					common.PROJECT,
					basePath,
					taskEntityTypesMapping,
					validationErrors
				)
			)

			await Promise.all(projectValidationPromises)

			//get all entity type validations for task
			const subTaskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.SUBTASKS,
					status: common.STATUS_ACTIVE,
				},
				projectData.organization_code,
				projectData.tenant_code,
				['value', 'validations']
			)

			// // validation for task is not empty
			if (projectData?.tasks?.length > 0) {
				basePath = common.TASKS
				// validate task
				await Promise.all(
					projectData.tasks.map(async (task, taskIndex) => {
						// Validate task entities
						let taskPath = `${basePath}[${taskIndex}]`
						await Promise.all(
							taskEntityTypes.map(async (taskEntityType) => {
								await this.validateEntityData(
									task,
									taskEntityType,
									common.TASKS,
									taskPath,
									taskEntityTypesMapping,
									validationErrors
								)
							})
						)

						// Validate child tasks if they exist
						if (task.children && task.children.length > 0) {
							await Promise.all(
								task.children.map(async (childTask, childTaskIndex) => {
									// Validate task entities
									let subTaskPath = `${basePath}[${taskIndex}].${common.CHILDREN}[${childTaskIndex}]`
									await Promise.all(
										subTaskEntityTypes.map(async (subTaskEntityType) => {
											await this.validateEntityData(
												childTask,
												subTaskEntityType,
												common.SUB_TASK,
												subTaskPath,
												taskEntityTypesMapping,
												validationErrors
											)
										})
									)
								})
							)
						}
					})
				)
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

			//create the review entry
			if (reviewerIds.length > 0) {
				//create entry in reviews table
				let reviewsData = reviewerIds.map((reviewer_id) => ({
					resource_id: projectData.id,
					reviewer_id,
					status: common.REVIEW_STATUS_NOT_STARTED,
					organization_code: userDetails.organization_code,
				}))

				await reviewsQueries.bulkCreate(reviewsData)
				delete reviewsData.status
				await reviewsResourcesQueries.bulkCreate(reviewsData)
			}

			//update the reviews and resource status
			let resourceStatus = common.RESOURCE_STATUS_SUBMITTED
			if (
				projectData.stage === common.RESOURCE_STAGE_REVIEW ||
				projectData.status === common.RESOURCE_STATUS_SUBMITTED
			) {
				//Update the review status if the resource has been submitted before
				await reviewsQueries.update(
					{
						organization_code: projectData.organization_code,
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
				projectData.organization_code,
				projectData.tenant_code
			)
			if (!isReviewMandatory) {
				const publishResource = await reviewService.publishResource(
					resourceId,
					projectData.user_id,
					projectData.organization_code,
					projectData.tenant_code
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
			// add user action
			eventEmitter.emit(common.EVENT_ADD_USER_ACTION, {
				actionCode: common.USER_ACTIONS[projectData.type].RESOURCE_SUBMITTED,
				userId: userDetails.id,
				objectId: resourceId,
				objectType: common.MODEL_NAMES.RESOURCE,
				orgId: userDetails.organization_code,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROJECT_SUBMITTED_SUCCESSFULLY',
				result: { id: projectData.id },
			})
		} catch (error) {
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
	static async validateEntityData(entityData, entityType, model, sourceType, entityMapping, validationErrors = []) {
		try {
			let fieldData = entityData[entityType.value]

			if (
				model == common.TASKS &&
				entityData.allow_evidences == common.TRUE &&
				entityType.value == common.FILE_TYPE
			) {
				// Check if file types are selected
				if (!entityData?.evidence_details?.file_types?.length) {
					validationErrors.push(
						utils.errorObject(
							sourceType + '.' + common.TASK_EVIDENCE,
							common.FILE_TYPE,
							'File type not selected'
						)
					)
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
					validationErrors.push(
						utils.errorObject(
							model == common.PROJECT ? entityType.value : sourceType,
							model === common.PROJECT ? '' : entityType.value,
							requiredValidation.message || `${entityType.value} is required`
						)
					)
				}
			}

			let solutionDetailsPath = `${sourceType}.${common.SOLUTION_DETAILS}`

			//length check validation
			let maxLengthValidation = entityType.validations.find(
				(validation) => validation.type == common.MAX_LENGTH_VALIDATION
			)

			if (
				maxLengthValidation &&
				((typeof fieldData === common.STRING && fieldData !== null) ||
					(typeof fieldData === common.OBJECT &&
						fieldData !== null &&
						Object.keys(fieldData).length > 0 &&
						fieldData.name))
			) {
				let lengthCheck = utils.checkLength(
					maxLengthValidation,
					entityType.value === common.SOLUTION_DETAILS ? fieldData.name : fieldData
				)

				if (!lengthCheck) {
					validationErrors.push(
						utils.errorObject(
							entityType.value === common.SOLUTION_DETAILS
								? solutionDetailsPath
								: model === common.PROJECT
								? entityType.value
								: sourceType,
							model === common.PROJECT ? '' : entityType.value,
							maxLengthValidation.message ||
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
						utils.errorObject(
							model == common.TASKS && entityType.value == common.FILE_TYPE
								? `${sourceType}.${common.TASK_EVIDENCE}`
								: sourceType,
							entityType.value,
							checkEntities.message
						)
					)
				}
			}

			// Check regex pattern will check max length and special characters
			let regexValidation = entityType.validations.find(
				(validation) => validation.type == common.REGEX_VALIDATION
			)
			if (regexValidation && fieldData) {
				//validate learning resource validation
				if (entityType.value === common.LEARNING_RESOURCE) {
					const validationPromises = fieldData.map(async (eachResource, i) => {
						let learningResourcePath =
							sourceType == ''
								? `${common.LEARNING_RESOURCE}[${i}]`
								: `${sourceType}.${common.LEARNING_RESOURCE}[${i}]`
						// Validate the name is present
						if (!eachResource.name) {
							validationErrors.push(
								utils.errorObject(
									learningResourcePath,
									common.NAME,
									regexValidation.message || `Required learning resource name in ${model}`
								)
							)
						}

						// Validate the URL is present
						if (!eachResource.url) {
							validationErrors.push(
								utils.errorObject(
									learningResourcePath,
									common.URL,
									regexValidation.message || `Required learning resource URL in ${model}`
								)
							)
						}

						// Validate the URL against the regex pattern
						if (eachResource.url && entityMapping[common.LEARNING_RESOURCE]?.validations) {
							const validateURL = utils.checkRegexPattern(
								entityMapping[common.LEARNING_RESOURCE].validations,
								eachResource.url
							)
							if (!validateURL) {
								validationErrors.push(
									utils.errorObject(
										learningResourcePath,
										common.URL,
										regexValidation.message || `Invalid learning resource URL in ${model}`
									)
								)
							}
						}
					})

					await Promise.all(validationPromises)
				} else if (
					entityType.value === common.RECOMMENDED_DURATION &&
					fieldData &&
					Object.keys(fieldData).length > 0
				) {
					if (!fieldData.number) {
						validationErrors.push(
							utils.errorObject(
								model == common.PROJECT ? entityType.value : sourceType,
								common.NUMBER,
								'Enter duration in numbers'
							)
						)
					}

					let checkRegex = utils.checkRegexPattern(regexValidation, fieldData.number)
					if (!checkRegex) {
						validationErrors.push(
							utils.errorObject(
								model == common.PROJECT ? entityType.value : sourceType,
								common.NUMBER,
								regexValidation.message || 'Enter duration in numbers'
							)
						)
					}
				} else if (
					entityType.value === common.SOLUTION_DETAILS &&
					fieldData &&
					Object.keys(fieldData).length > 0 &&
					JSON.parse(process.env.ENABLE_OBSERVATION_IN_PROJECTS)
				) {
					//validate the observation url
					let regex = new RegExp(process.env.OBSERVATION_DEEP_LINK_REGEX)
					let validateURL = regex.test(fieldData.link)
					if (!validateURL) {
						validationErrors.push(
							utils.errorObject(
								solutionDetailsPath,
								common.LINK,
								regexValidation.message || `Invalid observation URL in ${model}`
							)
						)
					}
				} else {
					let checkRegex = utils.checkRegexPattern(regexValidation, fieldData)
					if (!checkRegex) {
						validationErrors.push(
							utils.errorObject(
								model == common.PROJECT ? entityType.value : sourceType,
								model === common.PROJECT ? '' : entityType.value,
								regexValidation.message ||
									`${entityType.value} can only include alphanumeric characters with spaces, -, _, &, <>`
							)
						)
					}
				}
			}
			if (validationErrors.length > 0)
				return {
					hasError: true,
					error: [],
					validationErrors,
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
	 * get the base_template_url as a string to store in the certificate
	 * @param {Object} bodyData - req body data
	 * @returns {Promise<void>} - BodyData with basetemplateURL
	 */

	static async getResourceCertificateurl(bodyData) {
		try {
			if (bodyData?.certificate?.base_template_url) {
				let ceritificateBaseTemplateUrl = bodyData.certificate.base_template_url

				if (typeof ceritificateBaseTemplateUrl === common.STRING && ceritificateBaseTemplateUrl.trim() !== '') {
					return bodyData
				} else if (
					typeof ceritificateBaseTemplateUrl === common.OBJECT &&
					ceritificateBaseTemplateUrl !== null &&
					ceritificateBaseTemplateUrl.url
				) {
					// If it's an object with `url`, set it
					bodyData.certificate.base_template_url = ceritificateBaseTemplateUrl.url
					return bodyData
				} else {
					// Fallback if it's empty string, null, or unexpected type
					bodyData.certificate.base_template_url = ''
					return bodyData
				}
			}
			return bodyData
		} catch (error) {
			throw error
		}
	}
}

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

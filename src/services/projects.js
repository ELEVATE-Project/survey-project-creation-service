/**
 * name : projects.js
 * author : Priyanka Pradeep
 * created-date : 24-May-2024
 * Description : Project Helper.
 */
const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const filesService = require('@services/files')
const userRequests = require('@requests/user')
const orgExtensionService = require('@services/organization-extension')
const _ = require('lodash')
const { Op } = require('sequelize')
const reviewsQueries = require('@database/queries/reviews')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const utils = require('@generics/utils')
const resourceService = require('@services/resource')
const reviewService = require('@services/reviews')
const endpoints = require('@constants/endpoints')
const consumptionConfig = require('@consumption/config')
const requests = require('@generics/requests')
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

			if (orgConfig?.result?.config?.external_resource_visibility_policy) {
				// get visibility and related_org details
				const result = await this.populateVisibilityAndRelatedOrgs(projectData, orgConfig, orgCode, tenantCode)
				if (result.success) {
					projectData = result.dataObject
				}
			}

			let projectCreate
			try {
				//create project
				projectCreate = await resourceQueries.create(projectData)

				// upload to blob
				const resourceId = projectCreate.id

				const projectUploadStatus = await resourceService.uploadToCloud(
					common.PROJECT_UPLOAD_FILE_NAME,
					orgCode,
					tenantCode,
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
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
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
				orgCode,
				tenantCode,
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
				statusCode: httpStatusCode.internal_server_error,
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
			// check if the project exists
			const resourceFilterQuery = {
				id: resourceId,
				user_id: loggedInUserId,
				type: common.PROJECT,
				organization_code: organizationCode,
				tenant_code: tenantCode,
				status: common.RESOURCE_STATUS_DRAFT,
				stage: common.RESOURCE_STAGE_CREATION,
			}

			let project = await resourceQueries.findOne(resourceFilterQuery)

			if (!project?.id) {
				return responses.failureResponse({
					message: 'PROJECT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// delete the project
			let updatedProject = await resourceQueries.deleteOne(resourceId, organizationCode, tenantCode)

			if (updatedProject === 0) {
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
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
	/**
	 * Project details
	 * @method
	 * @name details
	 * @param {String} projectId - Project id
	 * @param {String} tenantCode - tenant code
	 * @param {String} orgCode - organization code
	 * @returns {JSON} - Project data.
	 */

	static async details(projectId, orgCode, tenantCode, commentsOptions = {}) {
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
				},
				options
			)

			if (!project?.id) {
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
					let resultData = response?.result || {}

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
					}
					result = { ...result, ...resultData }
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
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
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
			let taskLength = projectData.tasks ? projectData.tasks.length : 0
			if (taskLength > parseInt(process.env.MAX_PROJECT_TASK_COUNT, 10)) {
				validationErrors.push(
					utils.errorObject(common.TASKS, '', 'Project task count has exceeded the maximum allowed limit')
				)
			}

			// Validate entity tagging
			await this._validateEntityTagging(projectData, validationErrors)

			//validate task start_date and end_date if enabled
			await this._validateTaskDates(projectData, validationErrors)

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

				if (!reviewers.success) {
					throw {
						message: 'REVIEWER_IDS_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
					}
				}

				//written as a backup will remove once the user service PR merged
				if (Array.isArray(reviewers?.data?.result?.data) && reviewers.data.result.data.length > 0) {
					reviewerIds = reviewers.data.result.data.map((item) => item.id)
				} else {
					// If no valid reviewers data is found, return an error response
					throw {
						message: 'REVIEWER_IDS_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
					}
				}

				//return error message if the reviewer is invalid or not found
				if (uniqueReviewerIds.length > reviewers.data.result.data.length) {
					throw {
						message: 'REVIEWER_IDS_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
					}
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
			if (taskLength > 0) {
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
									validationErrors,
									userDetails
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
												validationErrors,
												userDetails
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
					tenant_code: userDetails.tenant_code,
				}))

				await reviewsQueries.bulkCreate(reviewsData)
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
	 * Project republish
	 * @method
	 * @name republish
	 * @param {Integer} projectId - Project Id.
	 * @param {Object} userDetails - User details
	 * @returns {JSON} - project republish response.
	 */
	static async republish(projectId, userDetails) {
		try {
			// Fetch project details with authorization check
			const projectDetailsResponse = await this.details(
				projectId,
				userDetails.organization_code,
				userDetails.tenant_code
			)

			if (projectDetailsResponse.statusCode !== httpStatusCode.ok) {
				throw {
					message: 'DONT_HAVE_PROJECT_ACCESS',
					statusCode: httpStatusCode.bad_request,
				}
			}
			const projectData = projectDetailsResponse.result

			// Validate project status is PUBLISHED
			if (projectData.status !== common.RESOURCE_STATUS_PUBLISHED) {
				throw {
					message: 'CANNOT_REPUBLISH_UNPUBLISHED_PROJECT',
					statusCode: httpStatusCode.bad_request,
				}
			}

			// Validate project has not been already published
			if (projectData.published_id) {
				throw {
					message: 'PROJECT_ALREADY_PUBLISHED',
					statusCode: httpStatusCode.bad_request,
				}
			}

			// Initiate republish process
			const republishResponse = await reviewService.publishResource(
				projectId,
				projectData.user_id,
				projectData.organization_code,
				projectData.tenant_code,
				userDetails.token
			)

			if (![httpStatusCode.ok, httpStatusCode.accepted].includes(republishResponse.statusCode)) {
				throw {
					message: republishResponse.message || 'PROJECT_REPUBLISH_FAILED',
					statusCode: httpStatusCode.bad_request,
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROJECT_REPUBLISHED_SUCCESSFULLY',
				result: { id: projectData.id },
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || 'RESOURCE_VALIDATION_FAILED',
				statusCode: error.statusCode || httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
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
	static async validateEntityData(
		entityData,
		entityType,
		model,
		sourceType,
		entityMapping,
		validationErrors = [],
		userDetails
	) {
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
				// Add validation error when a required field is missing,
				// except for tasks of type 'project' and "obseravtion", which are handled separately below.
				if (
					!required &&
					entityType.value != common.TASK_TYPE_PROJECT &&
					entityType.value != common.OBSERVATION
				) {
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

			//check for reflection url is present and valid

			if (entityType.value === common.TASK_TYPE_REFLECTION && entityData.type === common.TASK_TYPE_REFLECTION) {
				let reflectionPath =
					sourceType == '' ? `${common.TASK_TYPE_REFLECTION}` : `${sourceType}.${common.TASK_TYPE_REFLECTION}`
				// Validate the name is present
				if (!entityData.name) {
					validationErrors.push(
						utils.errorObject(
							reflectionPath,
							common.NAME,
							regexValidation.message || `Required learning reflection name in ${model}`
						)
					)
				}

				// Validate the URL is present
				if (!entityData.link) {
					validationErrors.push(
						utils.errorObject(
							reflectionPath,
							common.URL,
							regexValidation.message || `Required learning reflection URL in ${model}`
						)
					)
				}

				// Validate the URL against the regex pattern
				if (entityData.link && entityMapping[common.TASK_TYPE_REFLECTION]?.validations) {
					const validateURL = utils.checkRegexPattern(
						entityMapping[common.TASK_TYPE_REFLECTION].validations,
						entityData.link
					)
					if (!validateURL) {
						validationErrors.push(
							utils.errorObject(
								reflectionPath,
								common.URL,
								regexValidation.message || `Invalid REFLECTION URL in ${model}`
							)
						)
					}
				}
			}

			//check for project as a task
			if (
				model == common.TASKS &&
				entityType.value === common.TASK_TYPE_PROJECT &&
				entityData.type === common.TASK_TYPE_PROJECT
			) {
				let projectPath =
					sourceType == '' ? `${common.TASK_TYPE_PROJECT}` : `${sourceType}.${common.TASK_TYPE_PROJECT}`
				// Validate the project_id is present
				if (!entityData.project_id) {
					validationErrors.push(
						utils.errorObject(
							projectPath,
							common.PROJECT_ID,
							regexValidation.message || `Required project_id${model}`
						)
					)
				}
				// Validate published projectId
				if (entityData.project_id && entityMapping[common.TASK_TYPE_PROJECT]?.validations) {
					const validateProject = await resourceQueries.findOne(
						{
							id: entityData.project_id,
							type: common.PROJECT,
							status: common.RESOURCE_STATUS_PUBLISHED,
						},
						[]
					)
					// Validate that the project has a published_id
					// Only perform this check if the consumption service is not SELF
					if (process.env.CONSUMPTION_SERVICE !== common.SELF && !validateProject?.published_id) {
						validationErrors.push(
							utils.errorObject(
								projectPath,
								common.PROJECT_ID,
								requiredValidation.message || `Project not PUBLISHED${model}`
							)
						)
					}
				}
			}

			//check for observation as a task
			if (
				model == common.TASKS &&
				entityType.value === common.OBSERVATION &&
				entityData.type === common.OBSERVATION
			) {
				let observationPath = sourceType == '' ? `${common.OBSERVATION}` : `${sourceType}.${common.OBSERVATION}`
				// Validate the parent solution externalId is present
				if (!entityData.external_id || entityData.external_id.trim() === '') {
					validationErrors.push(
						utils.errorObject(
							observationPath,
							common.EXTERNAL_ID,
							requiredValidation.message || `Required ExternalId${model}`
						)
					)
				}
				// Validate published externalId
				if (entityData.external_id && entityMapping[common.OBSERVATION]?.validations) {
					let consumptionServiceUrl = consumptionConfig.fetchConsumptionServiceUrls(common.OBSERVATION)
					if (!consumptionServiceUrl) {
						return responses.failureResponse({
							message: 'CONSUMPTION_LINK_NOT_FOUND',
							statusCode: httpStatusCode.bad_request,
							result,
						})
					}
					// Override for Sunbird
					if (process.env.CONSUMPTION_SERVICE === common.SUNBIRD) {
						consumptionServiceUrl = process.env.INTERFACE_SERVICE_HOST
					}
					const url = utils.buildUrl(consumptionServiceUrl, endpoints.DB_FIND, {}, 'solutions')

					// Body for dbFind
					const payload = {
						query: {
							externalId: entityData.external_id,
							type: common.OBSERVATION,
							isReusable: common.TRUE,
						},
					}

					const response = await requests.post(url, payload, userDetails.token, true)

					if (!response.success || !response.data) {
						return responses.failureResponse({
							message: 'DB_FIND_FAILED',
							statusCode: httpStatusCode.internal_server_error,
						})
					}

					const results = response.data?.result || []
					// Validate that the solution exits in samiksha service
					// Only perform this check if the consumption service is not SELF
					if (process.env.CONSUMPTION_SERVICE !== common.SELF && (results.length === 0 || !results[0]._id)) {
						validationErrors.push(
							utils.errorObject(
								projectPath,
								common.PROJECT_ID,
								requiredValidation.message || `Solution not found${model}`
							)
						)
					}
				}
			}

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
	 * Validates task start and end dates
	 * @method
	 * @name _validateTaskDates
	 * @param {Object} projectData - Project data containing tasks to validate
	 * @param {Array} validationErrors - Array to collect validation errors
	 * @returns {void} - Modifies validationErrors array in place
	 */
	static async _validateTaskDates(projectData, validationErrors = []) {
		const tasks = projectData.tasks || []
		if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
			return
		}

		// Check if task date validation is enabled (environment or organization level)
		const isTaskDateValidationEnabled = await this._isTaskDateValidationEnabled(
			projectData.organization_code,
			projectData.tenant_code
		)

		if (!isTaskDateValidationEnabled) {
			return
		}

		// Recursively validate all tasks and their children
		this._validateTasksRecursively(tasks, common.TASKS, validationErrors)
	}

	/**
	 * Checks if task date validation is enabled at environment or organization level
	 * @method
	 * @name _isTaskDateValidationEnabled
	 * @param {String} organizationCode - Organization code
	 * @param {String} tenantCode - Tenant code
	 * @returns {Promise<Boolean>} - True if validation is enabled
	 * @private
	 */
	static async _isTaskDateValidationEnabled(organizationCode, tenantCode) {
		// 1. Default to environment-level setting
		let isEnabled = String(process.env.ENABLE_TASK_START_END_DATE_IN_PROJECTS || 'false').toLowerCase() === 'true'

		// 2. Get organization-level configuration and override if it exists
		const orgConfig = await orgExtensionService.getConfig(organizationCode, tenantCode)

		if (orgConfig.statusCode === httpStatusCode.ok && orgConfig?.result?.resource) {
			const projectOrgConfig = orgConfig.result.resource.find((item) => item.resource_type === common.PROJECT)
			// If org-level config for 'enable_task_start_end_date' is explicitly defined, it overrides the environment default
			if (projectOrgConfig && projectOrgConfig.enable_task_start_end_dates !== undefined) {
				isEnabled = String(projectOrgConfig.enable_task_start_end_dates).toLowerCase() === 'true'
			}
		}

		return isEnabled
	}

	/**
	 * Recursively validates tasks and their children
	 * @method
	 * @name _validateTasksRecursively
	 * @param {Array} tasks - Array of tasks to validate
	 * @param {String} basePath - Base path for error messages
	 * @param {Array} validationErrors - Array to collect validation errors
	 * @returns {void} - Modifies validationErrors array in place
	 * @private
	 */
	static _validateTasksRecursively(tasks, basePath, validationErrors) {
		tasks.forEach((task, index) => {
			const taskPath = `${basePath}[${index}]`
			this._validateSingleTaskDates(task, taskPath, validationErrors)

			// Recursively validate child tasks (subtasks) if they exist
			if (task.children && Array.isArray(task.children) && task.children.length > 0) {
				this._validateTasksRecursively(task.children, `${taskPath}.children`, validationErrors)
			}
		})
	}

	/**
	 * Validates a single task's start and end dates
	 * @method
	 * @name _validateSingleTaskDates
	 * @param {Object} task - Task object to validate
	 * @param {String} taskPath - Path identifier for error messages
	 * @param {Array} validationErrors - Array to collect validation errors
	 * @returns {void} - Modifies validationErrors array in place
	 * @private
	 */
	static _validateSingleTaskDates(task, taskPath, validationErrors) {
		const taskType = taskPath.includes(common.CHILDREN) ? 'Subtask' : 'Task'
		const hasStartDate = !!(task.start_date && task.start_date.trim())
		const hasEndDate = !!(task.end_date && task.end_date.trim())

		// Check required fields
		if (!hasStartDate) {
			validationErrors.push(utils.errorObject(taskPath, common.START_DATE, `${taskType} start date is required`))
		}
		if (!hasEndDate) {
			validationErrors.push(utils.errorObject(taskPath, common.END_DATE, `${taskType} end date is required`))
		}

		// Validate date formats if dates exist
		const isStartDateValid = hasStartDate && utils.isValidDate(task.start_date)
		const isEndDateValid = hasEndDate && utils.isValidDate(task.end_date)

		if (hasStartDate && !isStartDateValid) {
			validationErrors.push(
				utils.errorObject(taskPath, common.START_DATE, `${taskType} start date must be a valid date`)
			)
		}
		if (hasEndDate && !isEndDateValid) {
			validationErrors.push(
				utils.errorObject(taskPath, common.END_DATE, `${taskType} end date must be a valid date`)
			)
		}

		// Validate date ordering only if both are present and valid
		if (isStartDateValid && isEndDateValid && new Date(task.start_date) > new Date(task.end_date)) {
			validationErrors.push(
				utils.errorObject(taskPath, common.END_DATE, `${taskType} end date must be after start date`)
			)
		}
	}

	/**
	 * Validates entity tagging based on organization and project settings.
	 * @method
	 * @name _validateEntityTagging
	 * @param {Object} projectData - The project data.
	 * @param {Array} validationErrors - Array to collect validation errors.
	 * @returns {Promise<void>}
	 * @private
	 */
	static async _validateEntityTagging(projectData, validationErrors) {
		try {
			// 1. Default to environment-level setting
			let isEntityTaggingEnabled =
				String(process.env.ENABLE_ENTITY_TAGGING_IN_PROJECTS || 'false').toLowerCase() === 'true'

			// 2. Get organization-level configuration and override if it exists
			const orgConfig = await orgExtensionService.getConfig(
				projectData.organization_code,
				projectData.tenant_code
			)

			if (orgConfig.statusCode === httpStatusCode.ok && orgConfig?.result?.resource) {
				const projectOrgConfig = orgConfig.result.resource.find((item) => item.resource_type === common.PROJECT)
				// If org-level config for 'enable_entity_tagging' is explicitly defined, it overrides the environment default
				if (projectOrgConfig && projectOrgConfig.enable_entity_tagging !== undefined) {
					isEntityTaggingEnabled = String(projectOrgConfig.enable_entity_tagging).toLowerCase() === 'true'
				}
			}

			// 3. If tagging is enabled, validate the project-specific setting
			if (isEntityTaggingEnabled) {
				const projectTaggingEnabled =
					String(projectData.enable_entity_tagging || 'false').toLowerCase() === 'true'

				if (projectTaggingEnabled && !projectData.entity_type) {
					validationErrors.push(utils.errorObject(common.ENTITY_TYPE, '', 'Entity type is required'))
				}
			}
		} catch (error) {
			// Log the error and continue without blocking submission
			console.error('Error in _validateEntityTagging:', error)
		}
	}

	/**
	 * Populates visibility and related organization details for a program or project.
	 * @method
	 * @name populateVisibilityAndRelatedOrgs
	 * @param {Object} dataObject - Target object to populate (e.g. programData or projectData).
	 * @param {Object} orgConfig - Organization configuration object (from org service).
	 * @param {String} orgCode - Code of the current organization.
	 * @param {String}tenantCode - Tenant code for identifying the tenant.
	 * @returns {Promise<Object>} - Returns an object containing success flag, dataObject, statusCode, and message.
	 */
	static async populateVisibilityAndRelatedOrgs(dataObject, orgConfig, orgCode, tenantCode) {
		try {
			// Set visibility from org configuration
			dataObject.visibility = orgConfig?.result?.config?.external_resource_visibility_policy

			//Fetch related organizations
			const getRelatedOrgs = await userRequests.fetchOrg(orgCode, tenantCode)

			if (!getRelatedOrgs.success || !getRelatedOrgs?.data?.result?.related_org_details) {
				return {
					success: false,
					statusCode: httpStatusCode.internal_server_error,
					message: 'COULD_NOT_FETCH_ORG_DETAILS',
				}
			}

			const visibleOrg = getRelatedOrgs.data.result.related_org_details.map((eachValue) => eachValue.code)

			// Assign visible organization codes
			dataObject.visible_to_organizations = visibleOrg

			return { success: true, dataObject }
		} catch (error) {
			return {
				success: false,
				statusCode: httpStatusCode.internal_server_error,
				message: error.message || 'SOMETHING_WENT_WRONG',
			}
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

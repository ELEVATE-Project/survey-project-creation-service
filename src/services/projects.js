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
const entityTypeQuery = require('@database/queries/entityType')
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

			let fileName = loggedInUserId + resourceId + orgId + 'project.json'

			let getSignedUrl = await filesService.getSignedUrl(
				{ [resourceId]: { files: [fileName] } },
				common.PROJECT,
				loggedInUserId
			)

			let config = {
				method: 'put',
				maxBodyLength: Infinity,
				url: getSignedUrl.result[resourceId].files[0].url,
				headers: {
					'Content-Type': 'multipart/form-data',
				},
				data: JSON.stringify(bodyData),
			}

			let projectUploadStatus = await axios.request(config)
			if (projectUploadStatus.status == 200 || projectUploadStatus.status == 201) {
				let filter = {
					id: resourceId,
					organization_id: orgId,
				}
				let updateData = {
					meta: { title: bodyData.title },
					title: bodyData.title,
					updated_by: loggedInUserId,
					blob_path: getSignedUrl.result[resourceId].files[0].file,
				}
				let updatedProject = await resourceQueries.updateOne(filter, updateData)
				if (updatedProject === 0) {
					return responses.failureResponse({
						message: 'PROJECT_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
				return responses.successResponse({
					statusCode: httpStatusCode.accepted,
					message: 'PROJECT_UPDATED_SUCCESSFUL',
					result: updatedProject,
				})
			}
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
					result = { ...result, ...response.result }
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

			const allowed_fileTypes_entities = await entityTypeQuery.findUserEntityTypeAndEntities(
				{
					value: common.TASK_ALLOWED_FILE_TYPES,
					status: common.STATUS_ACTIVE,
				},
				userDetails,
				['id', 'value', 'has_entities', 'validations']
			)

			for (let entityType of entityTypes) {
				const fieldData = projectData[entityType.value]

				if (entityType.validations.required) {
					const required = utils.checkRequired(entityType, fieldData)
					if (!required) {
						throw responses.failureResponse({
							message: `${entityType.value} not added`,
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
							error: utils.errorObject(common.BODY, entityType.value),
						})
					}
				}

				if (fieldData && Object.keys(entityType.validations).includes('max_length')) {
					const max_text_length = entityType.validations.max_length
					const checkLength = utils.lengthChecker(max_text_length, fieldData.length)
					if (checkLength > 0) {
						throw responses.failureResponse({
							message: `Max length value exceeded for project ${entityType.value}`,
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
							error: utils.errorObject(common.BODY, entityType.value),
						})
					}
				}

				if (entityType.has_entities) {
					const checkEntities = utils.checkEntities(entityType, fieldData)
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
					const checkRegex = utils.checkRegexPattern(entityType, fieldData)
					if (checkRegex) {
						throw responses.failureResponse({
							message: `Special characters not allowed in ${entityType.value}`,
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
							error: utils.errorObject(common.BODY, entityType.value),
						})
					}
				}
			}

			if (!Object.keys(projectData).includes(common.TASKS) || projectData.tasks.length < 1) {
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
				['id', 'value', 'validations', 'has_entities']
			)

			//TODO: This dont have code for each type of validation please make sure that in future
			//when adding new validadtion include code for that
			// Using forEach for iterating through tasks and taskEntityTypes

			for (let task of projectData.tasks) {
				for (let taskEntityType of taskEntityTypes) {
					const fieldData = task[taskEntityType.value]

					if (fieldData && taskEntityType.validations.required) {
						const required = await utils.checkRequired(taskEntityType, fieldData)
						if (!required) {
							throw responses.failureResponse({
								message: `task.${taskEntityType.value} not added`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.TASKS, taskEntityType.value),
							})
						}
					}

					if (fieldData && taskEntityType.has_entities) {
						const checkEntities = utils.checkEntities(taskEntityType, fieldData)

						if (!checkEntities.status) {
							throw responses.failureResponse({
								message: checkEntities.message,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.TASKS, taskEntityType.value),
							})
						}
					}

					if (fieldData && taskEntityType.validations.regex) {
						const checkRegex = utils.checkRegexPattern(taskEntityType, fieldData)
						if (checkRegex) {
							throw responses.failureResponse({
								message: `Special characters not allowed in ${taskEntityType.value}`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.TASKS, taskEntityType.value),
							})
						}
					}

					if (fieldData && Object.keys(taskEntityType.validations).includes('max_length')) {
						const max_task_description_length = taskEntityType.validations.max_length

						const checkLength = utils.lengthChecker(max_task_description_length, fieldData.length)

						if (checkLength > 0) {
							throw responses.failureResponse({
								message: `Max length value exceeded for Task ${taskEntityType.value}`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.TASKS, taskEntityType.value),
							})
						}
					}
				}

				// TODO: Get file types from products teams and add validation for them
				// entity model mapping add one more key. file types . Ask Nivedhitha accepted file types
				// dont check file_types.length , change it from array to string. in API - docs also
				if (task.allow_evidences == common.TRUE) {
					if (task.evidence_details.file_types.length < 1) {
						throw responses.failureResponse({
							message: 'FILE_TYPE_NOT_SELECTED',
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
							error: utils.errorObject(common.BODY, common.FILE_TYPE),
						})
					}

					const allowed_fileTypes_entitiesList = allowed_fileTypes_entities.reduce((acc, taskEntityType) => {
						if (taskEntityType.value === common.TASK_ALLOWED_FILE_TYPES) {
							acc.push(...taskEntityType.entities.map((entity) => entity.value))
						}
						return acc
					}, [])

					const difference = _.difference(task.evidence_details.file_types, allowed_fileTypes_entitiesList)

					if (difference.length > 0) {
						throw responses.failureResponse({
							message: 'FILE_TYPE_INVALID',
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
							error: utils.errorObject(common.TASK_EVIDENCE, common.FILE_TYPE),
						})
					}
				}

				if (task.learning_resources && task.learning_resources.length > 0) {
					const subTaskEntityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
						{
							model: common.SUBTASKS,
							status: common.STATUS_ACTIVE,
						},
						userDetails,
						['value', 'validations']
					)
					for (const learningResource of task.learning_resources) {
						const xx = subTaskEntityTypes[0]?.validations?.max_length

						if (Object.keys(subTaskEntityTypes[0].validations).includes('max_length')) {
							const validateLRtitleLength = utils.lengthChecker(
								subTaskEntityTypes[0]?.validations?.max_length,
								learningResource.name.length
							)

							if (validateLRtitleLength > 0) {
								throw responses.failureResponse({
									message: `Max length value exceeded for title in ${subTaskEntityTypes[0].value}`,
									statusCode: httpStatusCode.bad_request,
									responseCode: 'CLIENT_ERROR',
									error: utils.errorObject(common.TASKS, subTaskEntityTypes[0].value),
								})
							}
						}
						const validateURL = utils.checkRegexPattern(subTaskEntityTypes[0], learningResource.url)
						if (validateURL) {
							throw responses.failureResponse({
								message: 'INCORRECT_LEARNING_RESOURCE',
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, common.CHILDREN),
							})
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
				})
				let orgReviewerIds = []
				if (orgReviewers.success) {
					orgReviewerIds = orgReviewers.data.result.data.map((item) => item.id)
				}
				if (orgReviewerIds.length <= 0) {
					throw responses.failureResponse({
						message: 'REVIEWER_IDS_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
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
			return error
		}
	}
}

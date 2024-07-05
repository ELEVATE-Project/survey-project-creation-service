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

			let projectCreate = await resourceQueries.create(projectData)
			const mappingData = {
				resource_id: projectCreate.id,
				creator_id: loggedInUserId,
				organization_id: orgId,
			}
			await resourceCreatorMappingQueries.create(mappingData)
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PROJECT_CREATED_SUCCESSFULLY',
				result: { id: projectCreate.id },
			})
		} catch (error) {
			console.log(error, 'error')
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

			const fetchResourceId = await resourceQueries.findOne(
				{
					id: resourceId,
					organization_id: fetchOrgId.organization_id,
					status: common.STATUS_DRAFT,
				},
				{ attributes: ['id'] }
			)

			if (!fetchResourceId) {
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
					statusCode: httpStatusCode.created,
					message: 'REVIEWER_LIST_FETCHED_SUCCESSFULLY',
					result: reviewers.data.result,
				})
			} else {
				return responses.successResponse({
					statusCode: httpStatusCode.created,
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

			let entityTypes = await entityModelMappingQuery.findEntityTypes(
				{
					model: common.PROJECT,
					status: common.STATUS_ACTIVE,
				},
				userDetails.organization_id,
				['value', 'has_entities', 'validations']
			)

			const entities = []

			// Using forEach instead of for loop to collect entities
			entityTypes.forEach((entityType) => {
				const projectEntityData = projectData[entityType.value]
				if (entityType.has_entities && projectEntityData) {
					if (Array.isArray(projectEntityData)) {
						projectEntityData.forEach((item) => {
							entities.push(item.value)
						})
					} else if (typeof projectEntityData === common.OBJECT) {
						entities.push(projectEntityData.value)
					}
				}
			})

			const allEntities = await entityService.read({ value: entities }, userDetails.id)

			// Using forEach instead of for loop for entity type validations
			entityTypes.forEach((entityType) => {
				const projectEntityData = projectData[entityType.value]

				if (entityType.validations.required) {
					if (entityType.has_entities) {
						if (
							!projectEntityData ||
							(Array.isArray(projectEntityData) && projectEntityData.length === 0)
						) {
							throw responses.failureResponse({
								message: `${entityType.value} not added`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, entityType.value),
							})
						}

						let validEntities = utils.validateEntities(projectEntityData, allEntities)
						if (!validEntities) {
							throw responses.failureResponse({
								message: `invalid ${entityType.value} added`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, entityType.value),
							})
						}
					} else {
						if (!projectEntityData || projectEntityData === '') {
							throw responses.failureResponse({
								message: `${entityType.value} should not be empty`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, entityType.value),
							})
						}
						if (entityType.value !== common.TASKS) {
							let checkForRegex = utils.checkRegexPattarn(projectEntityData, entityType.validations)
							if (checkForRegex) {
								throw responses.failureResponse({
									message: `Special characters not allowed in ${entityType.value}`,
									statusCode: httpStatusCode.bad_request,
									responseCode: 'CLIENT_ERROR',
									error: utils.errorObject(common.BODY, entityType.value),
								})
							}
						}
					}
				} else {
					if (entityType.has_entities) {
						let validEntities = utils.validateEntities(projectEntityData, allEntities)
						if (!validEntities) {
							throw responses.failureResponse({
								message: `invalid ${entityType.value} added`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, entityType.value),
							})
						}
					} else {
						if (entityType.value !== common.TASKS && entityType.value) {
							let checkForRegex = utils.checkRegexPattarn(projectEntityData, entityType.validations)
							if (checkForRegex) {
								throw responses.failureResponse({
									message: `Special characters not allowed in ${entityType.value}`,
									statusCode: httpStatusCode.bad_request,
									responseCode: 'CLIENT_ERROR',
									error: utils.errorObject(common.BODY, entityType.value),
								})
							}
						}
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
			}

			let taskEntityTypes = await entityModelMappingQuery.findEntityTypes(
				{
					model: common.TASKS,
					status: common.STATUS_ACTIVE,
				},
				userDetails.organization_id,
				['value', 'validations']
			)

			// Using forEach for iterating through tasks and taskEntityTypes
			projectData.tasks.forEach(async (task) => {
				taskEntityTypes.forEach(async (taskEntityType) => {
					if (taskEntityType.validations.required) {
						if (!task[taskEntityType.value] || task[taskEntityType.value] === '') {
							throw responses.failureResponse({
								message: `${taskEntityType.value} should not be empty`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, `task.${taskEntityType.value}`),
							})
						}
						let validateRegex = utils.checkRegexPattarn(
							task[taskEntityType.value],
							taskEntityType.validations
						)
						if (validateRegex) {
							throw responses.failureResponse({
								message: `Special characters not allowed in task.${taskEntityType.value}`,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, `task.${taskEntityType.value}`),
							})
						}
					}
				})

				if (task.allow_evidences == common.TRUE && task.evidence_details.file_types.length < 1) {
					throw responses.failureResponse({
						message: 'FILE_TYPE_NOT_SELECTED',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
						error: utils.errorObject(common.BODY, 'file_types'),
					})
				}

				if (task.learning_resources && task.learning_resources.length > 0) {
					let subTaskEntityTypes = await entityModelMappingQuery.findEntityTypes(
						{
							model: common.SUBTASKS,
							status: common.STATUS_ACTIVE,
						},
						userDetails.organization_id,
						['value', 'validations']
					)
					task.learning_resources.forEach((learningResource) => {
						let validateURL = utils.checkRegexPattarn(
							learningResource.url,
							subTaskEntityTypes[0].validations
						)
						if (validateURL) {
							throw responses.failureResponse({
								message: 'INCORRECT_LEARNING_RESOURCE',
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
								error: utils.errorObject(common.BODY, 'children'),
							})
						}
					})
				}
			})

			await resourceQueries.updateOne({ id: projectData.id }, { status: common.RESOURCE_STATUS_SUBMITTED })

			if (bodyData.hasOwnProperty('reviwer_ids') && bodyData.reviwer_ids.length > 0) {
				let reviewsData = bodyData.reviwer_ids.map((reviewer_id) => ({
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

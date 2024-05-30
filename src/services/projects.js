const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const filesService = require('@services/files')
const userRequests = require('@requests/user')
const _ = require('lodash')
const axios = require('axios')

module.exports = class ProjectsHelper {
	/**
	 *  project create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - project id
	 */
	static async create(orgId, loggedInUserId) {
		try {
			let projectData = {
				type: common.PROJECT,
				status: common.STATUS_DRAFT,
				user_id: loggedInUserId,
				organization_id: orgId,
				meta: {},
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
			}
			let projectCreate = await resourceQueries.create(projectData)
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
			let { categories, recommeneded_for, languages, ...projectData } = bodyData
			categories = categories.map((key) => {
				return { label: key, value: key }
			})
			recommeneded_for = recommeneded_for.map((key) => {
				return { label: key, value: key }
			})
			languages = languages.map((key) => {
				return { label: key, value: key }
			})
			projectData.categories = categories
			projectData.languages = languages
			projectData.recommeneded_for = recommeneded_for

			let fileName = loggedInUserId + resourceId + orgId + 'project.json'

			let getSignedUrl = await filesService.getSignedUrl(
				{ [resourceId]: { files: [fileName + 'project.json'] } },
				common.PROJECT,
				loggedInUserId
			)

			let config = {
				method: 'put',
				maxBodyLength: Infinity,
				url: getSignedUrl.result[resourceId].files[0].url,
				headers: {
					// ...data.getHeaders(),
					'Content-Type': 'multipart/form-data',
				},
				data: JSON.stringify(projectData),
			}

			let projectUploadStatus = await axios.request(config)
			if (projectUploadStatus.status == 200 || projectUploadStatus.status == 201) {
				let filter = {
					id: resourceId,
					organization_id: orgId,
				}
				let updateData = {
					meta: { title: bodyData.title },
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
}

/* eslint-disable no-useless-catch */
/* eslint-disable no-undef */
const db = require('@database/models/index')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const rolloutQueries = require('@database/queries/rollouts')
const resourceService = require('@services/resource')
const resourceQueries = require('@database/queries/resources')
const filesService = require('@services/files')
const orgExtension = require('@services/organization-extension')
const userRequests = require('@requests/user')
const { Op } = require('sequelize')
module.exports = class RolloutsHelper {
	/**
	 * Rollout create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - rollout id
	 */
	static async create(bodyData, loggedInUserId, orgId) {
		const transaction = await db.sequelize.transaction()
		try {
			//validate the resource
			let resource = await resourceQueries.findOne({
				id: bodyData.resource_id,
				organization_id: orgId,
				stage: common.RESOURCE_STAGE_COMPLETION,
			})

			if (!resource?.id) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let rolloutData = {
				title: bodyData.title,
				resource_type: resource.type,
				resource_id: resource.id,
				status: common.ROLLOUT_STATUS_PENDING,
				start_date: bodyData.start_date,
				end_date: bodyData.end_date,
				type: common.ROLLOUT_TYPE_PROGRAM,
				user_id: loggedInUserId,
				organization_id: orgId,
				created_by: loggedInUserId,
				updated_by: loggedInUserId,
			}

			let rolloutCreate
			try {
				//create rollout
				rolloutCreate = await rolloutQueries.create(rolloutData)

				// upload to blob
				const rolloutId = rolloutCreate.id

				const rolloutUploadStatus = await resourceService.uploadToCloud(
					common.ROLLOUT_UPLOAD_FILE_NAME,
					rolloutCreate.id,
					common.ROLL_OUT,
					loggedInUserId,
					bodyData
				)

				if (
					rolloutUploadStatus.result.status == httpStatusCode.ok ||
					rolloutUploadStatus.result.status == httpStatusCode.created
				) {
					let filter = {
						id: rolloutId,
						organization_id: orgId,
					}

					let updateData = {
						updated_by: loggedInUserId,
						blob_path: rolloutUploadStatus.blob_path,
					}

					const [updateCount] = await rolloutQueries.updateOne(filter, updateData, {
						returning: true,
						raw: true,
						transaction,
					})

					if (updateCount === 0) {
						await transaction.rollback()
						return responses.failureResponse({
							message: 'ROLLOUT_NOT_FOUND',
							statusCode: httpStatusCode.bad_request,
							responseCode: 'CLIENT_ERROR',
						})
					}
				} else {
					// If file upload fails, rollback the transaction and delete the created entry
					if (rolloutCreate.id)
						await rolloutQueries.deleteOne(rolloutCreate.id, rolloutCreate.organization_id)
					await transaction.rollback()
					throw new Error('FILE_UPLOADED_FAILED')
				}
			} catch (error) {
				if (rolloutCreate.id) await rolloutQueries.deleteOne(rolloutCreate.id, rolloutCreate.organization_id)
				await transaction.rollback()
				return responses.failureResponse({
					message: error.message || error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Commit the transaction if everything goes well
			await transaction.commit()

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ROLLOUT_SAVED_SUCCESSFULLY',
				result: { id: rolloutCreate.id },
			})
		} catch (error) {
			await transaction.rollback() // Rollback transaction on any error
			throw error
		}
	}

	/**
	 * Rollout details
	 * @method
	 * @name details
	 * @param {String} rolloutId - Rollout id
	 * @param {String} orgId - Organization id
	 * @param {String} loggedInUserId - User id
	 * @returns {JSON} - Rollout Details
	 */
	static async details(rolloutId, orgId, loggedInUserId) {
		try {
			let result = {
				organization: {},
			}

			const rollout = await rolloutQueries.findOne({
				id: rolloutId,
				organization_id: orgId,
				user_id: loggedInUserId,
				type: common.ROLLOUT_TYPE_PROGRAM,
			})

			if (!rollout?.id) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			//get the data from storage
			if (rollout.blob_path) {
				const response = await filesService.fetchJsonFromCloud(rollout.blob_path)
				if (
					response.statusCode === httpStatusCode.ok &&
					response.result &&
					Object.keys(response.result).length > 0
				) {
					let resultData = {
						...response.result,
						...rollout,
					}

					delete resultData['blob_path']
					const userDetails = await this.fetchUserDetails([resultData.viewers])
					const viewerUserIds = resultData.viewers
					resultData.viewers = []
					if (userDetails && Object.keys(userDetails).length > 0) {
						resultData.viewers = viewerUserIds.map((user) => {
							return userDetails[user]
						})
					}

					// fetch the org details from user service
					const organizationDetails = await orgExtension.fetchOrganizationDetails([rollout.organization_id])
					if (organizationDetails?.[rollout.organization_id]) {
						resultData.organization = _.pick(organizationDetails[rollout.organization_id], [
							'id',
							'name',
							'code',
						])
					}
					result = { ...resultData }
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ROLLOUT_FETCHED_SUCCESSFULLY',
				result: result,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Rollout List
	 * @method
	 * @name list
	 * @param {String} organization_id
	 * @param {String} loggedInUserId
	 * @param {Object} queryParams
	 * @param {String} searchText
	 * @param {Integer} page
	 * @param {Integer} limit
	 * @returns {JSON} - List of rollouts
	 */
	static async list(organization_id, loggedInUserId, queryParams, searchText = '', page, limit) {
		try {
			let result = {
				data: [],
				count: 0,
			}
			let filters = {
				organization_id,
				user_id: loggedInUserId,
				type: common.ROLLOUT_TYPE_PROGRAM,
			}

			if (searchText && searchText != '') {
				filters.title = {
					[Op.iLike]: '%' + searchText + '%',
				}
			}

			if (queryParams.resource_type && queryParams.resource_type != '') {
				filters.resource_type = queryParams.resource_type
			}

			if (queryParams.status && queryParams.status != '') {
				filters.status = {
					[Op.in]: queryParams.status.trim().split(','),
				}
			}

			const sort = await this.constructSortOptions(queryParams?.sort_by, queryParams?.sort_order)

			const rolloutList = await rolloutQueries.findAllAndCount(
				filters,
				[
					'id',
					'type',
					'resource_type',
					'resource_id',
					'title',
					'status',
					'start_date',
					'end_date',
					'organization_id',
					'created_by',
					'created_at',
					'updated_at',
				],
				{
					limit,
					offset: common.getPaginationOffset(page, limit),
					order: [sort],
				}
			)
			if (rolloutList.result.length <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'ROLLOUT_LISTED_SUCCESSFULLY',
					result,
				})
			}
			let orgList = []

			rolloutList.result.forEach((eachRollout) => {
				orgList.push(eachRollout.organization_id)
			})

			// fetch the user details from user service
			const userDetails = await this.fetchUserDetails([loggedInUserId])

			// fetch the org details from user service
			const orgDetails = await orgExtension.fetchOrganizationDetails(orgList)

			let rolloutFinalList = []

			rolloutList.result.forEach((eachRollout) => {
				eachRollout['creator'] = userDetails[eachRollout.created_by]
					? userDetails[eachRollout.created_by].name
					: null
				eachRollout['organization'] = orgDetails[eachRollout.organization_id]
					? orgDetails[eachRollout.organization_id]
					: null
				delete eachRollout['created_by']
				delete eachRollout['organization_id']
				rolloutFinalList.push(eachRollout)
			})

			result = {
				data: rolloutFinalList,
				count: rolloutList.count,
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'ROLLOUT_LISTED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Rollout update
	 * @method
	 * @name update
	 * @param {Integer} rolloutId - Rollout Id.
	 * @param {Object} bodyData - request data.
	 * @param {String} loggedInUserId - userId
	 * @param {String} orgId - organization id
	 * @returns {JSON} - rollout update response.
	 */

	static async update(rolloutId, bodyData, loggedInUserId, orgId) {
		try {
			let rollout = await rolloutQueries.findOne({
				id: rolloutId,
				organization_id: orgId,
			})

			if (!rollout?.id) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (rollout.user_id !== loggedInUserId) {
				return responses.failureResponse({
					message: 'DONT_HAVE_ROLLOUT_ACCESS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Prevent changes to the resource id if a rollout is published
			if (bodyData.resource_id && bodyData.resource_id != rollout.resource_id) {
				if (rollout.rollout_date || bodyData.published_id) {
					return responses.failureResponse({
						message: 'CANT_CHANGE_RESOURCE',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				let resource = await resourceQueries.findOne({
					id: bodyData.resource_id,
					organization_id: orgId,
					stage: common.RESOURCE_STAGE_COMPLETION,
				})

				if (!resource?.id) {
					return responses.failureResponse({
						message: 'RESOURCE_NOT_FOUND',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
			}

			bodyData = _.omit(bodyData, ['id', 'resource_type', 'type', 'organization_id', 'user_id'])

			if (bodyData.targeting_criteria) {
				const rolloutUploadStatus = await resourceService.uploadToCloud(
					common.ROLLOUT_UPLOAD_FILE_NAME,
					rolloutId,
					common.ROLL_OUT,
					loggedInUserId,
					bodyData
				)
				if (
					rolloutUploadStatus.result.status == httpStatusCode.ok ||
					rolloutUploadStatus.result.status == httpStatusCode.created
				) {
					bodyData.blob_path = rolloutUploadStatus.blob_path
				} else {
					throw new Error('FILE_UPLOADED_FAILED')
				}
			}

			let filter = {
				id: rolloutId,
				organization_id: orgId,
			}

			let updateData = {
				updated_by: loggedInUserId,
				...bodyData,
			}

			const [updateCount, updatedRolledout] = await rolloutQueries.updateOne(filter, updateData, {
				returning: true,
				raw: true,
			})

			if (updateCount === 0) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ROLLOUT_SAVED_SUCCESSFULLY',
				result: updatedRolledout[0].id,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get all details of users from the user service.
	 * @name fetchUserDetails
	 * @param {Array} userIds - array of userIds.
	 * @returns {Object} - Response contain object of user details
	 */
	static async fetchUserDetails(userIds) {
		const userDetailsResponse = await userRequests.list(common.FILTER_ALL.toLowerCase(), '', '', '', '', {
			user_ids: userIds,
		})
		let userDetails = {}
		if (userDetailsResponse.success && userDetailsResponse.data?.result?.data?.length > 0) {
			userDetails = _.keyBy(userDetailsResponse.data.result.data, 'id')
		}
		return userDetails
	}

	/**
	 * Generate sort filter
	 * @name constructSortOptions
	 * @param {Object} sort_by - Sort by value
	 * @param sort_order - sort_order value ASC / DESC
	 * @returns {JSON} - Response contain sort filter
	 */
	static async constructSortOptions(sort_by, sort_order) {
		let sort = []
		if (sort_by && sort_order) {
			sort.push(sort_by)
			sort.push(sort_order.toUpperCase() == common.SORT_DESC.toUpperCase() ? common.SORT_DESC : common.SORT_ASC)
		} else {
			sort.push(common.CREATED_AT)
			sort.push(common.SORT_DESC)
		}
		return sort
	}

	/**
	 * rollout delete
	 * @method
	 * @name delete
	 * @param {Integer} rolloutId - rollout id
	 * @param {String} loggedInUserId - user id
	 * @returns {JSON} - rollout delete response.
	 */

	static async delete(rolloutId, loggedInUserId) {
		try {
			let rollout = await rolloutQueries.findOne({
				id: rolloutId,
				user_id: loggedInUserId,
				status: common.ROLLOUT_STATUS_PENDING,
			})

			if (!rollout?.id) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let updatedRolledout = await rolloutQueries.deleteOne(rolloutId, rollout.organization_id)

			if (updatedRolledout === 0) {
				return responses.failureResponse({
					message: 'ROLLOUT_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ROLLOUT_DELETED_SUCCESSFULLY',
				result: {},
			})
		} catch (error) {
			return error
		}
	}
}

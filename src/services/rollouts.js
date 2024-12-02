/* eslint-disable no-useless-catch */
/* eslint-disable no-undef */
const db = require('@database/models/index')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const rolloutQueries = require('@database/queries/rollouts')
const resourceService = require('@services/resource')
const resourceQueries = require('@database/queries/resources')
const orgExtensionService = require('@services/organization-extension')
const userRequests = require('@requests/user')
module.exports = class RolloutsHelper {
	/**
	 * Rollout create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - project id
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
				const fileName = `${loggedInUserId}${rolloutId}rollout.json`

				const rolloutUploadStatus = await resourceService.uploadToCloud(
					fileName,
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
				message: 'ROLLOUT_CREATED_SUCCESSFULLY',
				result: { id: rolloutCreate.id },
			})
		} catch (error) {
			await transaction.rollback() // Rollback transaction on any error
			throw error
		}
	}
	/**
	 * Get Data Managers list
	 * @method
	 * @name getDataManagers
	 * @param {Object} req - request data.
	 * @returns {JSON} - List of data managers
	 */
	static async getDataManagers(orgId, pageNo, pageSize) {
		try {
			// get org config based on orgId
			const orgConfigs = await orgExtensionService.getConfig(orgId)
			// identify the roles have data manager access
			const dataManagerRoles = orgConfigs?.result?.config?.data_managers
			// fetch the users from user service
			const dataManagersList = await userRequests.list(dataManagerRoles.join(','), pageNo, pageSize, '', orgId)
			let result = {
				data: [],
				count: 0,
			}

			if (
				dataManagersList.success &&
				dataManagersList?.data?.result?.data &&
				dataManagersList?.data?.result?.data.length > 0
			) {
				result = dataManagersList?.data?.result
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'DATA_MANAGER_LIST_FETCHED',
				result,
			})
		} catch (error) {
			throw error
		}
	}
}

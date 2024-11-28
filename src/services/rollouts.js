/* eslint-disable no-useless-catch */
/* eslint-disable no-undef */
const db = require('@database/models/index')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const rolloutQueries = require('@database/queries/rollouts')
const resourceService = require('@services/resource')
const resourceQueries = require('@database/queries/resources')
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
			//check the rollout
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

			if (bodyData.targeting_criteria) {
				const fileName = `${loggedInUserId}${rolloutId}rollout.json`
				const rolloutUploadStatus = await resourceService.uploadToCloud(
					fileName,
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

			bodyData = _.omit(bodyData, ['id', 'resource_type', 'type', 'organization_id', 'user_id'])

			let filter = {
				id: rolloutId,
				organization_id: orgId,
			}

			let updateData = {
				updated_by: loggedInUserId,
				...bodyData,
			}

			const [updateCount] = await rolloutQueries.updateOne(filter, updateData, {
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
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}
}

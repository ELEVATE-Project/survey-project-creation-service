/* eslint-disable no-useless-catch */
/* eslint-disable no-undef */
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const utils = require('@generics/utils')
const rolloutQueries = require('@database/queries/rollouts')
const resourceService = require('@services/resource')
const resourceQueries = require('@database/queries/resources')
module.exports = class RolloutsHelper {
	/**
	 * Rollout create
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - project id
	 */
	static async create(bodyData, loggedInUserId, orgId) {
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

			//validation for start date and end date
			if (bodyData.start_date && bodyData.end_date) {
				const startDate = new Date(bodyData.start_date)
				const endDate = new Date(bodyData.end_date)

				if (startDate > endDate) {
					return responses.failureResponse({
						message: 'INVALID_DATE_RANGE',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
			}

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
					})

					if (updateCount === 0) {
						return responses.failureResponse({
							message: 'ROLLOUT_NOT_FOUND',
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
				message: 'ROLLOUT_CREATED_SUCCESSFULLY',
				result: { id: rolloutCreate.id },
			})
		} catch (error) {
			throw error
		}
	}
}

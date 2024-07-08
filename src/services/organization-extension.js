// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const orgExtensionQueries = require('@database/queries/organizationExtensions')
const reviewStageQueries = require('@database/queries/reviewStage')
const { UniqueConstraintError } = require('sequelize')
const responses = require('@helpers/responses')
const _ = require('lodash')
module.exports = class orgExtensionsHelper {
	/**
	 * Create Organization Config.
	 * @method
	 * @name createConfig
	 * @param {Object} bodyData - Organization Config body data.
	 * @returns {JSON} - Organization Config created response.
	 */

	static async createConfig(bodyData, organization_id) {
		try {
			bodyData.organization_id = organization_id
			const { resource_type, review_stages, review_type } = bodyData

			const validResourceTypes = process.env.RESOURCE_TYPES.split(',')
			if (!validResourceTypes.includes(resource_type)) {
				return responses.failureResponse({
					message: `resource_type ${resource_type} is not a valid`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			// Check if review_stages is not null, undefined, not an array, empty or invalid
			if (review_type === common.REVIEW_TYPE_SEQUENTIAL) {
				const isValidReviewStages =
					Array.isArray(review_stages) &&
					review_stages.length > 0 &&
					review_stages.every(
						(eachStage) =>
							eachStage &&
							typeof eachStage === 'object' &&
							!Array.isArray(eachStage) &&
							eachStage.hasOwnProperty('role') &&
							eachStage.hasOwnProperty('level')
					)

				if (!isValidReviewStages) {
					return responses.failureResponse({
						message: 'REVIEW_STAGES_INVALID',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				try {
					const createReviewStages = review_stages.map((stage) => ({
						...stage,
						organization_id,
						resource_type,
					}))

					await reviewStageQueries.bulkCreate(createReviewStages)
				} catch (error) {
					return responses.failureResponse({
						message: error.message,
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}
			}

			const orgExtension = await orgExtensionQueries.create(bodyData)

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CONFIG_ADDED_SUCCESSFULLY',
				result: orgExtension,
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'CONFIG_ALREADY_EXIST',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			throw error
		}
	}

	/**
	 * Update Organization Config.
	 * @method
	 * @name updateConfig
	 * @param {Object} bodyData - Organization config body data.
	 * @param {String} id - config id.
	 * @param {String} organization_id - organization id
	 * @returns {JSON} - Organization Config updated response.
	 */

	static async updateConfig(id, resource_type, bodyData, organization_id) {
		try {
			//validate resource type
			const validResourceTypes = process.env.RESOURCE_TYPES.split(',')
			if (!validResourceTypes.includes(resource_type)) {
				return responses.failureResponse({
					message: `resource_type ${resource_type} is not a valid`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			const { review_stages, review_type } = bodyData

			const filter = {
				id: id,
				resource_type: resource_type,
				organization_id: organization_id,
			}

			if (review_type === common.REVIEW_TYPE_SEQUENTIAL) {
				// Fetch existing review stages
				const existingReviewStages = await reviewStageQueries.findAll({
					resource_type: resource_type,
					organization_id: organization_id,
				})

				// Check if review_stages is not null, undefined, not an array, empty or invalid
				const isValidReviewStages =
					Array.isArray(review_stages) &&
					review_stages.length > 0 &&
					review_stages.every(
						(eachStage) =>
							eachStage &&
							typeof eachStage === 'object' &&
							!Array.isArray(eachStage) &&
							eachStage.hasOwnProperty('role') &&
							eachStage.hasOwnProperty('level')
					)

				if (existingReviewStages.length === 0 && !isValidReviewStages) {
					return responses.failureResponse({
						message: 'REVIEW_STAGES_INVALID',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				//review stage creation
				if (isValidReviewStages) {
					// Identify new review stages to add
					const newReviewStages = review_stages.filter(
						(stage) =>
							!existingReviewStages.some(
								(existingStage) =>
									existingStage.role === stage.role &&
									existingStage.level === stage.level &&
									existingStage.resource_type === resource_type &&
									existingStage.organization_id === organization_id
							)
					)

					// Add new review stages
					if (newReviewStages.length > 0) {
						const createReviewStages = newReviewStages.map((stage) => ({
							...stage,
							organization_id,
							resource_type,
						}))
						try {
							await reviewStageQueries.bulkCreate(createReviewStages)
						} catch (error) {
							return responses.failureResponse({
								message: error.message,
								statusCode: httpStatusCode.bad_request,
								responseCode: 'CLIENT_ERROR',
							})
						}
					}
				}
			}

			const [updateCount, updatedConfig] = await orgExtensionQueries.update(filter, bodyData, {
				returning: true,
				raw: true,
			})

			if (updateCount == 0) {
				return responses.failureResponse({
					message: 'ORG_CONFIG_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'ORG_CONFIG_UPDATED',
				result: updatedConfig,
			})
		} catch (error) {
			throw error
		}
	}
}

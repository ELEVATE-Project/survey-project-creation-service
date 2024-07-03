// Dependencies
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const orgExtensionQueries = require('@database/queries/organizationExtensions')
const reviewStageQueries = require('@database/queries/reviewStage')
const entityTypeQueries = require('@database/queries/entityType')
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
			const { resource_type } = bodyData

			const resources = await entityTypeQueries.findOneEntityTypeAndEntities({
				organization_id: organization_id,
				value: common.RESOURCES,
			})

			const resourceList = resources.entities
			const validResourceTypes = _.map(resourceList, 'value')
			if (!validResourceTypes.includes(resource_type)) {
				return responses.failureResponse({
					message: `resource_type ${resource_type} is not a valid`,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (bodyData.review_type === common.REVIEW_TYPE_SEQUENTIAL && bodyData.review_stages) {
				//review stage creation
				const reviewStages = bodyData.review_stages.map((stage) => ({
					...stage,
					organization_id,
					resource_type,
				}))

				await reviewStageQueries.bulkCreate(reviewStages)
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
			const filter = {
				id: id,
				resource_type: resource_type,
				organization_id: organization_id,
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

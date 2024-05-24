const common = require('@constants/common')
const organizationExtensionsQueries = require('@database/queries/organizationExtensions')
const _ = require('lodash')
const entites = require('@database/queries/entities')
const entityType = require('@database/queries/entityType')
const httpStatusCode = require('@generics/http-status')
const responses = require('@helpers/responses')
const { Op } = require('sequelize')
module.exports = class configsHelper {
	/**
	 * List Configs.
	 * @method
	 * @name list
	 * @param {Integer} organization_id
	 * @param {String} id -  id.
	 * @returns {JSON} - List of configs as response.
	 */

	static async list(organization_id) {
		try {
			let orgExtenstionData = {}
			let configData = []
			// define filter
			const filter = {
				organization_id,
			}
			// attributes to fetch from organisation Extenstion
			const attributes = common.INSTANCE_LEVEL_CONFIG_ATTRIBUTES

			const entity_type_and_entities = await entityType.findOneEntityTypeAndEntities({
				organization_id: organization_id,
				value: common.RESOURCES,
			})
			// fetch the current list of resources
			const resourceList = entity_type_and_entities.entities

			// convert the object into array
			const resourceListArr = resourceList.map(({ value }) => value)

			// instance level configurations from env as default configs
			const default_configs = {
				review_required: process.env.REVIEW_REQUIRED === 'true' ? true : false,
				show_reviewer_list: process.env.SHOW_REVIEWER_LIST === 'true' ? true : false,
				min_approval: Number(process.env.MIN_APPROVAL),
				review_type:
					process.env.REVIEW_TYPE.toUpperCase === common.REVIEW_TYPE_SEQUENTIAL
						? common.REVIEW_TYPE_SEQUENTIAL
						: common.REVIEW_TYPE_PARALLEL,
			}

			// fetch the configuration from Organization extension for the user's organization
			orgExtenstionData = await organizationExtensionsQueries.findMany(filter, attributes)

			// get the list of resource types not set by the org-admin
			let resourceTypeFromDB = []

			// fetch the config data
			configData = resourceListArr
				.map((resourceType) => {
					const filterData = orgExtenstionData.filter((orgExt) => {
						if (orgExt.resource_type.toLowerCase() === resourceType.toLowerCase()) {
							resourceTypeFromDB.push(orgExt.resource_type)
							return {
								review_required: orgExt.review_required,
								show_reviewer_list: orgExt.show_reviewer_list,
								min_approval: orgExt.min_approval,
								review_type: orgExt.review_type,
								resource_type: orgExt.resource_type,
							}
						}
					})
					return filterData
				})
				.flat()

			// check and fill for the missing configs from DB
			const missedResourceTypes = _.difference(resourceListArr, resourceTypeFromDB)
				.map((resourceType) => {
					return {
						...default_configs,
						resource_type: resourceType,
					}
				})
				.flat()

			configData = configData.length > 0 ? _.concat(configData, missedResourceTypes) : missedResourceTypes

			// return success message
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CONFIGS_FETCHED_SUCCESSFULLY',
				result: configData,
			})
		} catch (error) {
			// return error message
			return responses.failureResponse({
				statusCode: httpStatusCode.internal_server_error,
				message: 'CONFIG_FETCH_FAILED',
				result: [],
			})
		}
	}
}

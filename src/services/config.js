const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const organizationExtensionsQueries = require('@database/queries/organizationExtensions')
const { UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize')
const { Op } = require('sequelize')
const responses = require('@helpers/responses')
const _ = require('lodash')
const { Organizations } = require('aws-sdk')

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
		let orgExtenstionData = {}
		let configData = []
		try {
			// define filter
			const filter = {
				organization_id,
			}
			// attributes to fetch from organisation Extenstion
			const attributes = ['review_required', 'show_reviewer_list', 'min_approval', 'resource_type', 'review_type']
			// fetch the current list of resources
			const resourceList = common.RESOURCE_LIST

			// instance level configurations from env as default configs
			const default_configs = {
				review_required: process.env.REVIEW_REQUIRED == 'true' ? true : false,
				show_reviewer_list: process.env.SHOW_REVIEWER_LIST == 'true' ? true : false,
				min_approval: Number(process.env.MIN_APPROVAL),
				review_type:
					process.env.REVIEW_TYPE.toLowerCase == 'sequential'
						? common.REVIEW_TYPE.SEQUENTIAL
						: common.REVIEW_TYPE.PARALLEL,
			}

			// fetch the configuration from Organization extension for the user's organization
			orgExtenstionData = await organizationExtensionsQueries.findMany(filter, attributes)

			// get the list of resource types not set by the org-admin
			let resourceTypeFromDB = []

			// fetch the config data
			configData = resourceList
				.map((resourceType) => {
					const filterData = orgExtenstionData.filter((orgExt) => {
						if (orgExt.resource_type.toLowerCase() == resourceType.toLowerCase()) {
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
			const missedResourceTypes = _.difference(resourceList, resourceTypeFromDB)
				.map((resourceType) => {
					return {
						...default_configs,
						resource_type: resourceType,
					}
				})
				.flat()

			if (configData.length != 0) {
				// concat the data fetch from DB and env
				configData = _.concat(configData, missedResourceTypes)
			} else {
				// if there are no configs added by org admin
				// return all default value
				configData = missedResourceTypes
			}
		} catch (error) {
			return error
		}

		return configData
	}
}

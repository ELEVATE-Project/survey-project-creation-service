const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const _ = require('lodash')

module.exports = class resourceHelper {
	/**
	 * List resources of each users
	 * @method
	 * @name list
	 * @returns {JSON} - List of resources
	 */

	static async list(user_id, queryParams, pageNo, limit) {
		try {
			let result = {
				data: [],
				count: 0,
			}
			let sort = {
				sort_by: 'created_at',
				order: 'DESC',
			}
			let filter = {}
			if ('filter' in queryParams && queryParams.filter.toLowerCase() === common.FILTER_ALL.toLowerCase()) {
				filter = {
					user_id,
				}
			} else {
				if ('type' in queryParams && queryParams.type.length > 0) {
					filter.user_id = user_id
					filter.type = queryParams.type
				}

				if ('status' in queryParams && queryParams.status.length > 0) {
					filter.user_id = user_id
					filter.status = common.STATUS_ENUM[common.STATUS_ENUM.indexOf(queryParams.status.toUpperCase())]
				}
			}

			if (
				'sort_by' in queryParams &&
				'sort_order' in queryParams &&
				queryParams.sort_by.length > 0 &&
				queryParams.sort_order.length > 0
			) {
				sort.sort_by = queryParams.sort_by
				sort.order = queryParams.sort_order.toLowerCase() == 'desc' ? 'DESC' : 'ASC'
			}

			if (Object.keys(filter).length === 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'INVALID_FILTER',
					result,
				})
			}
			const resources = await resourceQueries.findAll(
				filter,
				['id', 'title', 'type', 'organization_id', 'status'],
				sort
			)

			if (resources.length <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCE_LISTED_SUCCESSFULLY',
					result,
				})
			}

			const uniqueOrganizationIds = [...new Set(resources.map((item) => item.organization_id))]
			const orgDetailsResponse = await userRequests.listOrganization(uniqueOrganizationIds)
			let orgDetails = {}
			if (orgDetailsResponse.success) {
				orgDetails = orgDetailsResponse.data.result.reduce((acc, org) => {
					acc[org.id] = org
					return acc
				}, {})
			}

			result.data = resources.map((res) => {
				res.organization = orgDetails[res.organization_id] ? orgDetails[res.organization_id] : {}
				delete res.organization_id
				return res
			})
			result.count = result.data.length

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			throw error
		}
	}
}

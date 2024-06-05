/**
 * name : validators/v1/resource.js
 * author : Adithya Dinesh
 * Date : 04-June-2024
 * Description : Resource Service
 */

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

	static async list(user_id, organization_id, queryParams, page, limit) {
		try {
			let result = {
				data: [],
				count: 0,
			}
			let sort = {
				sort_by: common.CREATED_AT,
				order: common.SORT_DESC,
			}
			let filter = {}
			if (
				common.QUERY_PARAMS.FILTER in queryParams &&
				queryParams.filter.toLowerCase() === common.FILTER_ALL.toLowerCase()
			) {
				filter = {
					organization_id,
				}
			} else {
				filter.user_id = user_id
				if (common.QUERY_PARAMS.TYPE in queryParams) {
					filter.type = queryParams.type
				}

				if (common.QUERY_PARAMS.STATUS in queryParams && queryParams.status.length > 0) {
					filter.status = queryParams.status.toUpperCase()
				}
			}

			if (
				common.QUERY_PARAMS.SORT_BY in queryParams &&
				common.QUERY_PARAMS.SORT_ORDER in queryParams &&
				queryParams.sort_by.length > 0 &&
				queryParams.sort_order.length > 0
			) {
				sort.sort_by = queryParams.sort_by
				sort.order =
					queryParams.sort_order.toUpperCase() == common.SORT_DESC.toUpperCase()
						? common.SORT_DESC
						: common.SORT_ASC
			}

			const resources = await resourceQueries.resourceList(
				filter,
				['id', 'title', 'type', 'organization_id', 'status'],
				sort,
				page,
				limit
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
			if (orgDetailsResponse.success && orgDetailsResponse.data?.result?.length > 0) {
				orgDetails = _.keyBy(orgDetailsResponse.data.result, 'id')
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

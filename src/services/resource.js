/**
 * name : validators/v1/resource.js
 * author : Adithya Dinesh
 * Date : 04-June-2024
 * Description : Resource Service
 */

const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const resourceCreatorMappingQueries = require('@database/queries/resourcesCreatorMapping')
const reviewsQueries = require('@database/queries/reviews')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const _ = require('lodash')
const { Op } = require('sequelize')
const filesService = require('@services/files')

module.exports = class resourceHelper {
	/**
	 * List resources of each users
	 * @method
	 * @name list
	 * @returns {JSON} - List of resources
	 */

	static async list(user_id, organization_id, queryParams, searchText = '', page, limit) {
		try {
			let result = {
				data: [],
				count: 0,
			}
			let sort = {
				sort_by: common.CREATED_AT,
				order: common.SORT_DESC,
			}
			let filter = {
				organization_id,
			}
			// fetch the details of resource and organization from resource creator mapping table by the user
			const resource_creator_mapping_data = await resourceCreatorMappingQueries.findAll({ creator_id: user_id }, [
				'resource_id',
				'organization_id',
			])

			// get the unique resource ids from resource creator mapping table by the user
			const uniqueResourceIds = [...new Set(resource_creator_mapping_data.map((item) => item.resource_id))]

			// get the unique organization ids from resource creator mapping table by the user
			const OrganizationIds = [...new Set(resource_creator_mapping_data.map((item) => item.organization_id))]

			if (queryParams[common.TYPE]) {
				filter.type = {
					[Op.in]: queryParams[common.TYPE].split(','),
				}
			}

			if (
				queryParams[common.PAGE_STATUS] === common.PAGE_STATUS_DRAFTS ||
				queryParams[common.PAGE_STATUS] === common.PAGE_STATUS_SUBMITTED_FOR_REVIEW
			) {
				// common filters for drafts page and submitted for review page
				filter.user_id = user_id

				filter.id = {
					[Op.in]: uniqueResourceIds,
				}

				filter.organization_id = {
					[Op.in]: OrganizationIds,
				}
				filter.status = {
					[Op.in]: common.PAGE_STATUS_VALUES[queryParams[common.PAGE_STATUS]],
				}
			}

			if (queryParams[common.PAGE_STATUS] === common.PAGE_STATUS_SUBMITTED_FOR_REVIEW) {
				// specific filters for submitted for review page

				const inReviewResources = await resourceQueries.findAll(filter, ['id'])

				const uniqueInReviewResourcesIds = [...new Set(inReviewResources.map((item) => item.id))]

				// count the number of resources with changes requested
				const changesCount = await reviewsQueries.countDistinct({
					organization_id: {
						[Op.in]: OrganizationIds,
					},
					resource_id: {
						[Op.in]: uniqueInReviewResourcesIds,
					},
					status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
				})
				result.changes_requested_count = changesCount

				if ((common.STATUS in queryParams) & (queryParams[common.STATUS] != '')) {
					// remove status which are not related
					filter.status = {
						[Op.in]: _.intersection(
							queryParams.status.split(',').map((status) => status.toUpperCase()),
							common.PAGE_STATUS_VALUES[queryParams[common.PAGE_STATUS]]
						),
					}

					if (queryParams.status.split(',').includes(common.REVIEW_STATUS_REQUESTED_FOR_CHANGES)) {
						// fetch the resource ids from review table - changes requested
						let changeRequestedResources = await reviewsQueries.findAll(
							{
								resource_id: {
									[Op.in]: uniqueResourceIds,
								},
								status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
								organization_id: {
									[Op.in]: OrganizationIds,
								},
							},
							['resource_id']
						)

						changeRequestedResources = [...new Set([..._.map(changeRequestedResources, 'resource_id')])]
						filter.id = {
							[Op.in]: changeRequestedResources,
						}
						filter.status = common.RESOURCE_STATUS_IN_REVIEW
					}
				}
			}

			if (searchText.length > 0) {
				filter.title = {
					[Op.iLike]: '%' + searchText + '%',
				}
			}

			if (
				common.SORT_BY in queryParams &&
				common.SORT_ORDER in queryParams &&
				queryParams.sort_by.length > 0 &&
				queryParams.sort_order.length > 0
			) {
				sort.sort_by = queryParams.sort_by
				sort.order =
					queryParams.sort_order.toUpperCase() == common.SORT_DESC.toUpperCase()
						? common.SORT_DESC
						: common.SORT_ASC
			}

			const response = await resourceQueries.resourceList(
				filter,
				['id', 'title', 'type', 'organization_id', 'status', 'user_id'],
				sort,
				page,
				limit
			)

			const resources = response.result

			if (resources.length <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCE_LISTED_SUCCESSFULLY',
					result,
				})
			}

			const uniqueOrganizationIds = [...new Set(resources.map((item) => item.organization_id))]
			const uniqueCreatorIds = [...new Set(resources.map((item) => item.user_id))]

			const orgDetailsResponse = await userRequests.listOrganization(uniqueOrganizationIds)
			const userDetailsResponse = await userRequests.list(
				common.FILTER_ALL.toLowerCase(),
				'',
				'',
				'',
				organization_id,
				{ user_ids: uniqueCreatorIds }
			)

			let orgDetails = {}
			let userDetails = {}

			if (orgDetailsResponse.success && orgDetailsResponse.data?.result?.length > 0) {
				orgDetails = _.keyBy(orgDetailsResponse.data.result, 'id')
			}

			if (userDetailsResponse.success && userDetailsResponse.data?.result?.data?.length > 0) {
				userDetails = _.keyBy(userDetailsResponse.data.result.data, 'id')
			}

			result.data = resources.map((res) => {
				res.organization = orgDetails[res.organization_id] ? orgDetails[res.organization_id] : {}
				res.creator =
					userDetails[res.user_id] && userDetails[res.user_id].name ? userDetails[res.user_id].name : ''
				delete res.user_id
				delete res.organization_id
				return res
			})

			result.count = response.count

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Resource Details
	 * @method
	 * @name getDetails
	 * @returns {JSON} - details of resource
	 */
	static async getDetails(resourceId) {
		try {
			let result = {
				organization: {},
			}

			const resource = await resourceQueries.findOne({
				id: resourceId,
			})

			if (!resource?.id) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			if (resource.blob_path) {
				const response = await filesService.fetchJsonFromCloud(resource.blob_path)
				if (
					response.statusCode === httpStatusCode.ok &&
					response.result &&
					Object.keys(response.result).length > 0
				) {
					result = { ...result, ...response.result }
				}
			}

			//get organization details
			let organizationDetails = await userRequests.fetchDefaultOrgDetails(resource.organization_id)
			if (organizationDetails.success && organizationDetails.data && organizationDetails.data.result) {
				resource.organization = _.pick(organizationDetails.data.result, ['id', 'name', 'code'])
			}

			delete resource.blob_path
			result = { ...result, ...resource }

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_FETCHED',
				result: result,
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Callback URL for Update Published Resource
	 * @method
	 * @name publishCallback
	 * @returns {JSON} - details of resource
	 */
	static async publishCallback(resourceId, publishedId) {
		try {
			let resource = await resourceQueries.updateOne(
				{
					id: resourceId,
				},
				{
					published_id: publishedId,
				}
			)

			if (resource === 0) {
				return responses.failureResponse({
					message: 'RESOURCE_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'RESOURCE_UPDATED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}
}

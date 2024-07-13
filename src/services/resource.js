/**
 * name : validators/v1/resource.js
 * author : Adithya Dinesh
 * Date : 04-June-2024
 * Description : Resource Service
 */

const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const resourceCreatorMappingQueries = require('@database/queries/resourcesCreatorMapping')
const reviewResourcesQueries = require('@database/queries/reviewsResources')
const reviewsQueries = require('@database/queries/reviews')
const reviewStagesQueries = require('@database/queries/reviewStage')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const configs = require('@services/config')
const _ = require('lodash')
const { Op } = require('sequelize')

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

			if (resource_creator_mapping_data.length <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCE_LISTED_SUCCESSFULLY',
					result,
				})
			}
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

	static async upForReview(user_id, organization_id, roles, queryParams, searchText = '', page, limit) {
		try {
			let result = {
				data: [],
				count: 0,
			}
			let sort = {
				sort_by: common.CREATED_AT,
				order: common.SORT_DESC,
			}
			let finalResourceIds = []
			let resourceIdsToBeRemoved = []

			// fetch orgnization based configurations for each resources
			const configList = await configs.list(organization_id)

			// org based resource review type look up
			const resourceWiseReviewType = configList.result.reduce((acc, item) => {
				acc[item.resource_type] = item.review_type
				return acc
			}, {})

			// fetch all resource type set as sequential review in the organization
			const resourceTypesInSequentialReview = Object.keys(resourceWiseReviewType).filter(
				(key) => resourceWiseReviewType[key] === common.REVIEW_TYPE_SEQUENTIAL
			)

			// fetch all resource type set as parallel review in the organization
			const resourceTypesInParallelReview = Object.keys(resourceWiseReviewType).filter(
				(key) => resourceWiseReviewType[key] === common.REVIEW_TYPE_PARALLEL
			)

			const userRoleTitles = [...new Set(roles.map((item) => item.title))]
			// fetch review level of the reviewer
			const reviewLevelDetails = await reviewStagesQueries.findAll(
				{
					organization_id,
					role: {
						[Op.in]: userRoleTitles,
					},
					resource_type: {
						[Op.in]: Object.keys(resourceWiseReviewType),
					},
				},
				{ attributes: ['resource_type', 'level'], order: [['level', 'ASC']] }
			)
			const resourceWiseLevels = {} //resource wise levels look up for the given reviewer
			reviewLevelDetails.forEach((item) => {
				if (!resourceWiseLevels[item.resource_type]) {
					resourceWiseLevels[item.resource_type] = item.level
				}
			})

			let uniqueResourceIds = []
			let uniqueOrganizationIds = [organization_id] //initialize current org id
			const commonAttributes = ['resource_id', 'organization_id']

			// check review resources and find all resources under the reviewer name.
			const reviewResources = await reviewResourcesQueries.findAll(
				{
					reviewer_id: user_id,
				},
				commonAttributes
			)

			if (reviewResources.length > 0) {
				// get the unique organization ids from reviewResources table by the reviewer
				uniqueOrganizationIds = [
					...new Set([...uniqueOrganizationIds, ...reviewResources.map((item) => item.organization_id)]),
				]
			}
			let reviewsFilter = {}
			let reviewsResponse = {}
			const in_progress_count = await reviewsQueries.countDistinct({
				organization_id: {
					[Op.in]: uniqueOrganizationIds,
				},
				reviewer_id: user_id,
				status: { [Op.in]: [common.REVIEW_STATUS_INPROGRESS, common.REVIEW_STATUS_CHANGES_UPDATED] },
			})

			if (common.STATUS in queryParams && queryParams[common.STATUS] === common.REVIEW_STATUS_INPROGRESS) {
				reviewsFilter = {
					reviewer_id: user_id,
					organization_id: { [Op.in]: uniqueOrganizationIds },
					status: { [Op.in]: [common.REVIEW_STATUS_INPROGRESS, common.REVIEW_STATUS_CHANGES_UPDATED] },
				}

				reviewsResponse = await reviewsQueries.findAll(reviewsFilter, commonAttributes)
				if (reviewsResponse.length > 0) {
					// get the unique organization ids from reviews table by the reviewer
					uniqueOrganizationIds = [...new Set(reviewsResponse.map((item) => item.organization_id))]

					// get the unique resource ids from reviews table by the reviewer
					uniqueResourceIds = [...new Set(reviewsResponse.map((item) => item.resource_id))]
					finalResourceIds = [...new Set(uniqueResourceIds)]
				}
			} else {
				reviewsFilter = {
					reviewer_id: user_id,
					organization_id: { [Op.in]: uniqueOrganizationIds },
					status: { [Op.in]: common.PAGE_STATUS_VALUES.up_for_review },
				}

				reviewsResponse = await reviewsQueries.findAll(reviewsFilter, commonAttributes)

				if (reviewsResponse.length > 0) {
					// get the unique organization ids from reviews table by the reviewer
					uniqueOrganizationIds = [...new Set(reviewsResponse.map((item) => item.organization_id))]

					// get the unique resource ids from reviews table by the reviewer
					uniqueResourceIds = [...new Set(reviewsResponse.map((item) => item.resource_id))]
				}

				// fetch all submitted and inreview resources from my orgs
				const allSequentialResourcesFromOrg = await resourceQueries.findAll(
					{
						organization_id,
						type: { [Op.in]: resourceTypesInSequentialReview },
						status: { [Op.in]: [common.RESOURCE_STATUS_SUBMITTED, common.RESOURCE_STATUS_IN_REVIEW] },
					},
					['id', 'type', 'next_stage']
				)

				const openToAllResourcesMatchingMyLevel = allSequentialResourcesFromOrg.map((item) => {
					if (item.next_stage === resourceWiseLevels[item.type]) return item.id
				})

				const allParallelResourcesFromOrg = await resourceQueries.findAll(
					{
						organization_id,
						type: { [Op.in]: resourceTypesInParallelReview },
						status: { [Op.in]: [common.RESOURCE_STATUS_SUBMITTED, common.RESOURCE_STATUS_IN_REVIEW] },
					},
					['id']
				)

				const allParallelResourceIdsFromOrg = allParallelResourcesFromOrg.map((item) => item.id)

				// remove all the resouces in sequential review picked up by another reviewer
				reviewsFilter = {
					reviewer_id: { [Op.notIn]: [user_id] },
					status: {
						[Op.in]: [
							common.REVIEW_STATUS_INPROGRESS,
							common.REVIEW_STATUS_CHANGES_UPDATED,
							common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
						],
					},
					resource_id: { [Op.in]: openToAllResourcesMatchingMyLevel },
				}
				reviewsResponse = await reviewsQueries.findAll(reviewsFilter, ['resource_id'])

				// push resource ids to resourceIdsToBeRemoved array
				resourceIdsToBeRemoved = reviewsResponse.map((item) => item.resource_id)

				finalResourceIds = _.difference(
					[
						...new Set([
							...uniqueResourceIds,
							...openToAllResourcesMatchingMyLevel,
							...allParallelResourceIdsFromOrg,
						]),
					],
					resourceIdsToBeRemoved
				)
			}

			const resourceFilter = {
				id: { [Op.in]: finalResourceIds },
				organization_id,
			}
			if (searchText != '')
				resourceFilter.title = {
					[Op.iLike]: '%' + searchText + '%',
				}

			if (common.TYPE in queryParams) {
				resourceFilter.type = queryParams[common.TYPE]
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
				resourceFilter,
				['id', 'title', 'type', 'organization_id', 'status', 'user_id'],
				sort,
				page,
				limit
			)
			result.data = response.result
			result.count = response.count
			result.in_progress_count = in_progress_count

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

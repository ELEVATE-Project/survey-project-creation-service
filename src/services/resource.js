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
const utils = require('@generics/utils')
const axios = require('axios')
const filesService = require('@services/files')
const commentQueries = require('@database/queries/comment')
const { Op, fn, col } = require('sequelize')

module.exports = class resourceHelper {
	/**
	 * List up for submittedForReview
	 * This is a creator centric API which will return the list of all the resources which are submitted for review.
	 * @method GET
	 * @name listAllSubmittedResources
	 * @param {String} type (optional) - Type of the resource. Ex : Projects , Observations etc...
	 * @param {String} search (optional) - Partial search of the resource with title.
	 * @param {String} status  (optional) - FIltered by statuses - 'INPROGRESS', 'NOT_STARTED', 'CHANGES_UPDATED', 'STARTED'
	 * @param {String} sort_by (optional) -  Column name where we should apply sort. By default it will be created_at
	 * @param {String} sort_order (optional) -  Order of the sort operation asc / desc . by default desc
	 * @param {Integer} page (optional) -  Used to skip to different pages. Used for pagination . If value is not passed, by default it will be 1
	 * @param {Integer} limit (optional) -  Used to limit the data. Used for pagination . If value is not passed, by default it will be 100
	 * @returns {JSON} - List of up for review resources
	 */

	static async listAllSubmittedResources(loggedInUserId, queryParams, searchText = '', page, limit) {
		let result = {
			data: [],
			count: 0,
		}
		let defaultFilter = {}
		let filter = {}
		const resourcesCreatedByMe = await this.resourcesCreatedByUser(loggedInUserId)
		if (resourcesCreatedByMe.length <= 0) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result,
			})
		}
		let uniqueResourceIds = resourcesCreatedByMe.map((item) => item.resource_id)

		// get the unique organization ids from resource creator mapping table by the user
		const OrganizationIds = utils.getUniqueElements(resourcesCreatedByMe.map((item) => item.organization_id))
		const distinctInreviewResourceIds = await reviewsQueries.distinctResources(
			{
				organization_id: {
					[Op.in]: OrganizationIds,
				},
				resource_id: {
					[Op.in]: uniqueResourceIds,
				},
				status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
			},
			['resource_id']
		)

		if (queryParams[common.STATUS] === common.REVIEW_STATUS_REQUESTED_FOR_CHANGES) {
			filter = {
				organization_id: {
					[Op.in]: OrganizationIds,
				},
				id: {
					[Op.in]: distinctInreviewResourceIds.resource_ids,
				},
				user_id: loggedInUserId,
			}
		} else {
			defaultFilter = {
				organization_id: {
					[Op.in]: OrganizationIds,
				},
				id: {
					[Op.in]: uniqueResourceIds,
				},
				user_id: loggedInUserId,
				status: {
					[Op.in]: common.PAGE_STATUS_VALUES[common.PAGE_STATUS_SUBMITTED_FOR_REVIEW],
				},
			}

			if (queryParams[common.STATUS]) {
				defaultFilter.status = {
					[Op.in]: queryParams[common.STATUS].split(','),
				}
			}

			filter = await this.constructCustomFilter(defaultFilter, queryParams, searchText)
		}

		const sort = await this.constructSortOptions(queryParams)
		const response = await resourceQueries.resourceList(
			filter,
			[
				'id',
				'title',
				'organization_id',
				'type',
				'status',
				'user_id',
				'created_at',
				'updated_at',
				'submitted_on',
				'published_on',
				'last_reviewed_on',
				'meta',
			],
			sort,
			page,
			limit
		)
		if (response.result.length <= 0) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result,
			})
		}

		const orgDetails = await this.fetchOrganizationDetails(
			utils.getUniqueElements(response.result.map((item) => item.organization_id))
		)
		const commentMapping = await this.fetchOpenComments(
			utils.getUniqueElements(distinctInreviewResourceIds.resource_ids)
		)
		const reviewDetails = await reviewsQueries.findAll(
			{
				organization_id: {
					[Op.in]: OrganizationIds,
				},
				resource_id: {
					[Op.in]: uniqueResourceIds,
				},
				status: {
					[Op.in]: [
						common.REVIEW_STATUS_REJECTED,
						common.REVIEW_STATUS_REJECTED_AND_REPORTED,
						common.REVIEW_STATUS_INPROGRESS,
						common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
					],
				},
			},
			['resource_id', 'reviewer_id', 'created_at', 'updated_at', 'status', 'notes']
		)
		let reviewerIds = []

		// create a mapping object for resourceId and review details to fetch the review details like reviewerId , status etc... using resource id
		const reviewDetailsMapping = reviewDetails.reduce((acc, item) => {
			acc[item.resource_id] = {
				reviewer_id: item.reviewer_id,
				updated_at: item.updated_at,
				created_at: item.created_at,
				status: item.status,
				reviewer_notes: item.notes,
			}
			reviewerIds.push(item.reviewer_id)
			return acc
		}, {})
		const userDetails = await this.fetchUserDetails(
			utils.getUniqueElements([...response.result.map((item) => item.user_id), ...reviewerIds])
		)

		const additionalResourceInformation = response.result.reduce((acc, resource) => {
			let additionalData = {}
			if (reviewDetailsMapping[resource.id]) {
				if (reviewDetailsMapping[resource.id].status !== common.REVIEW_STATUS_NOT_STARTED) {
					additionalData.reviewed_by = reviewDetailsMapping[resource.id].reviewer_id
						? userDetails[reviewDetailsMapping[resource.id].reviewer_id]?.name
						: null
					additionalData.reviewed_started_on = reviewDetailsMapping[resource.id].created_at
						? reviewDetailsMapping[resource.id].created_at
						: null
					if (
						reviewDetailsMapping[resource.id].status === common.REVIEW_STATUS_REJECTED ||
						reviewDetailsMapping[resource.id].status === common.REVIEW_STATUS_REJECTED_AND_REPORTED
					) {
						additionalData.rejected_at = reviewDetailsMapping[resource.id].updated_at
							? reviewDetailsMapping[resource.id].updated_at
							: null
					}
				}
				additionalData.review_status = reviewDetailsMapping[resource.id].status
				additionalData.review_status_updated = reviewDetailsMapping[resource.id].updated_at
				additionalData.is_comments = commentMapping[resource.id] ? commentMapping[resource.id] : false
				additionalData.reviewer_notes = reviewDetailsMapping[resource.id].reviewer_notes
			}
			acc[resource.id] = additionalData

			return acc
		}, {})

		result = await this.responseBuilder(response, userDetails, orgDetails, additionalResourceInformation)
		result.changes_requested_count = distinctInreviewResourceIds.count
		return responses.successResponse({
			statusCode: httpStatusCode.ok,
			message: 'RESOURCE_LISTED_SUCCESSFULLY',
			result,
		})
	}
	/**
	 * List of all draft resources
	 * Description : This is a creator centric API which will return the list of all the resources which are draft status.
	 * @method GET
	 * @name listAllDrafts
	 * @param {String} type (optional) -  Type of the resource. Ex : Projects , Observations etc...
	 * @param {String} search (optional) -  Partial search of the resource with title.
	 * @param {String} status  (optional) - FIltered by statuses - 'INPROGRESS', 'NOT_STARTED', 'CHANGES_UPDATED', 'STARTED'
	 * @param {String} sort_by (optional) -  Column name where we should apply sort. By default it will be created_at
	 * @param {String} sort_order (optional) -  Order of the sort operation asc / desc . by default desc
	 * @param {Integer} page (optional) -  Used to skip to different pages. Used for pagination . If value is not passed, by default it will be 1
	 * @param {Integer} limit (optional) -  Used to limit the data. Used for pagination . If value is not passed, by default it will be 100
	 * @returns {JSON} - List of drafts resources
	 */

	static async listAllDrafts(loggedInUserId, queryParams, searchText = '', page, limit) {
		let result = {
			data: [],
			count: 0,
		}

		const resourcesCreatedByMe = await this.resourcesCreatedByUser(loggedInUserId)
		if (resourcesCreatedByMe.length <= 0) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result,
			})
		}
		const uniqueResourceIds = resourcesCreatedByMe.map((item) => item.resource_id)

		// get the unique organization ids from resource creator mapping table by the user
		const OrganizationIds = utils.getUniqueElements(resourcesCreatedByMe.map((item) => item.organization_id))

		const filter = await this.constructCustomFilter(
			{
				organization_id: {
					[Op.in]: OrganizationIds,
				},
				id: {
					[Op.in]: uniqueResourceIds,
				},
				user_id: loggedInUserId,
				status: {
					[Op.in]: common.PAGE_STATUS_VALUES[common.PAGE_STATUS_DRAFTS],
				},
			},
			queryParams,
			searchText
		)

		const sort = await this.constructSortOptions(queryParams)
		const response = await resourceQueries.resourceList(
			filter,
			['id', 'title', 'organization_id', 'type', 'status', 'user_id', 'created_at', 'updated_at'],
			sort,
			page,
			limit
		)
		if (response.result.length <= 0) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result,
			})
		}

		const userDetails = await this.fetchUserDetails(
			utils.getUniqueElements(response.result.map((item) => item.user_id))
		)
		const orgDetails = await this.fetchOrganizationDetails(
			utils.getUniqueElements(response.result.map((item) => item.organization_id))
		)
		result = await this.responseBuilder(response, userDetails, orgDetails, {})

		return responses.successResponse({
			statusCode: httpStatusCode.ok,
			message: 'RESOURCE_LISTED_SUCCESSFULLY',
			result,
		})
	}

	/**
	 * Build response struct
	 * Description : This is the method used by the main functions to build the final output response.
	 * @name responseBuilder
	 * @param {Object} resourceDetails (mandatory) - Query response from resource table.
	 * @param {Object} userDetails (mandatory) - Key pair value of user details, fetched from user service. This object will be used by the service to fetch the user details using user id
	 * @param {Object} orgDetails  (mandatory) - Key pair value of org details, fetched from user service. This object will be used by the service to fetch org user details using org id
	 * @param {Object} additionalResourceInformation (mandatory) - If the response needs any additional information as per the products request , which is to be fetched from other tables , like reviews etc...
	 * @returns {JSON} - List of resources
	 */
	static async responseBuilder(resourceDetails, userDetails, orgDetails, additionalResourceInformation) {
		let result = {}

		result.data = resourceDetails.result.map((res) => {
			res.organization = orgDetails[res.organization_id] ? orgDetails[res.organization_id] : {}
			res.creator = userDetails[res.user_id] && userDetails[res.user_id].name ? userDetails[res.user_id].name : ''
			res.notes = res.meta.notes ? res.meta.notes : ''

			if (additionalResourceInformation[res.id]) {
				res = {
					...res,
					...additionalResourceInformation[res.id],
				}
			}
			delete res.user_id
			delete res.organization_id
			delete res.meta
			return res
		})

		result.count = resourceDetails.count
		return result
	}

	/**
	 * Construct custom filter
	 * Description : This is the method used by the main functions to build a custom filter. Checking the query params and appending valid queries.
	 * @name constructCustomFilter
	 * @param {Object} filter (mandatory) - <object> Existing filters
	 * @param {Object} queryParams (mandatory) - <object> queryParams passed in the API
	 * @param {String} searchText  (optional) - <string> Search string passed to the api
	 * @returns {Object} - Object of filter
	 */
	static async constructCustomFilter(filter, queryParams, searchText = '') {
		let returnFilter = {
			...filter,
		}
		if (searchText != '') {
			returnFilter.title = {
				[Op.iLike]: '%' + searchText + '%',
			}
		}

		if (queryParams[common.TYPE]) {
			returnFilter.type = {
				[Op.in]: queryParams[common.TYPE].split(','),
			}
		}

		return returnFilter
	}

	/**
	 * Fetch all open comments
	 * Description : This is the method used by the main functions to fetch the list of open comments in the list of resources
	 * @name fetchOpenComments
	 * @param {Array} resourceIds (mandatory) - List of resources
	 * @returns {Object} - Object of resource ids which has comments and true value.
	 */
	static async fetchOpenComments(resourceIds) {
		let comments = await commentQueries.findAll(
			{
				resource_id: {
					[Op.in]: resourceIds,
				},
				status: common.COMMENT_STATUS_OPEN,
			},
			['resource_id', [fn('COUNT', col('id')), 'comment_count']],
			{ group: ['resource_id'] }
		)

		const commentMapping = await comments.rows.reduce((acc, item) => {
			acc[item.resource_id] = parseInt(item.comment_count, 10) > 0 ? true : false
			return acc
		}, {})
		return commentMapping
	}

	/**
	 * Generate sort filter
	 * @name constructSortOptions
	 * @param {Object} queryParams -  queryParams contain sort details like sort_by, sort_order
	 * @returns {JSON} - Response contain sort filter
	 */
	static async constructSortOptions(queryParams) {
		let sort = {}
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
		return sort
	}

	/**
	 * Get all resources of User
	 * @name resourcesCreatedByUser
	 * @param {String} loggedInUserId -  loggedInUserId.
	 * @returns {Array} - Response contain array of resources
	 */
	static async resourcesCreatedByUser(loggedInUserId) {
		// fetch the details of resource and organization from resource creator mapping table by the user
		const resourceData = await resourceCreatorMappingQueries.findAll({ creator_id: loggedInUserId }, [
			'resource_id',
			'organization_id',
		])
		return resourceData
	}

	/**
	 * List up for review resources of reviewers
	 * Description : This is a reviewer centric API which will return the list of all the resources which the reviewer can review.
	 * 				 The list will contain all the resources the user is already reviewing  , resources which are assigned to the reviewer ,
	 * 				 sequential resources which are open to all and matching to the reviewers role level and open to all parallel review resources.
	 * @method GET
	 * @name upForReview
	 * @param {String} type (optional) -  Type of the resource. Ex : Projects , Observations etc...
	 * @param {String} search (optional) -  Partial search of the resource with title.
	 * @param {String} status  (optional) - FIltered by statuses - 'INPROGRESS', 'NOT_STARTED', 'CHANGES_UPDATED', 'STARTED'
	 * @param {String} sort_by (optional) -  Column name where we should apply sort. By default it will be created_at
	 * @param {String} sort_order (optional) -  Order of the sort operation asc / desc . by default desc
	 * @param {Integer} page (optional) -  Used to skip to different pages. Used for pagination . If value is not passed, by default it will be 1
	 * @param {Integer} limit (optional) -  Used to limit the data. Used for pagination . If value is not passed, by default it will be 100
	 *
	 * @returns {JSON} - List of up for review resources
	 */
	static async upForReview(queryParams, tokenDetails, searchText = '', page, limit) {
		try {
			// get user details from token
			const user_id = tokenDetails.id
			const organization_id = tokenDetails.organization_id
			const roles = tokenDetails.roles

			let result = {
				data: [],
				count: 0,
				in_progress_count: 0,
			}

			const sort = {
				sort_by: queryParams.sort_by || common.CREATED_AT,
				order: queryParams.sort_order?.toUpperCase() === common.SORT_ASC ? common.SORT_ASC : common.SORT_DESC,
			}
			let finalResourceIds = []
			let resourceIdsToBeRemoved = []
			let inProgressResources = []
			let uniqueOrganizationIds = [organization_id]

			// check review resources and find all resources and org for the reviewer name.
			const fetchReviewResourceDetails = await reviewResourcesQueries.findAll(
				{
					reviewer_id: user_id,
				},
				['organization_id']
			)
			if (fetchReviewResourceDetails) {
				uniqueOrganizationIds = utils.getUniqueElements(
					fetchReviewResourceDetails.map((item) => item.organization_id)
				)

				const distinctResourceIds = await reviewsQueries.distinctResources(
					{
						organization_id: {
							[Op.in]: uniqueOrganizationIds,
						},
						reviewer_id: user_id,
						status: { [Op.in]: [common.REVIEW_STATUS_INPROGRESS, common.REVIEW_STATUS_CHANGES_UPDATED] },
					},
					['resource_id']
				)

				result.in_progress_count = distinctResourceIds.count
				inProgressResources = utils.getUniqueElements(distinctResourceIds.resource_ids)
			}
			if (common.STATUS in queryParams && queryParams[common.STATUS] === common.REVIEW_STATUS_INPROGRESS) {
				finalResourceIds = inProgressResources
			} else {
				// fetch the resources types of an organization based on parallel and sequential review type
				let { sequential: resourceTypesInSequentialReview, parallel: resourceTypesInParallelReview } =
					await this.fetchResourceReviewTypes(organization_id)

				if (common.TYPE in queryParams && queryParams[common.TYPE]) {
					resourceTypesInSequentialReview = queryParams[common.TYPE].split(',')
					resourceTypesInParallelReview = queryParams[common.TYPE].split(',')
				}
				// if the organization have any resource type in sequential review type
				if (resourceTypesInSequentialReview.length > 0) {
					// fetch all sequential resource ids from org which are open to all
					const sequentialResourcesIds = await this.findSequentialResources(
						organization_id,
						roles,
						resourceTypesInSequentialReview
					)
					// add the resource ids in the final array
					finalResourceIds = [...finalResourceIds, ...sequentialResourcesIds]

					// fetch all resource ids assigned to another reviewer or reviewing by another reviewer
					resourceIdsToBeRemoved = await this.findResourcesPickedUpByAnotherReviewer(
						user_id,
						finalResourceIds
					)
				}
				// if the organization have any resource type in parallel review type
				if (resourceTypesInParallelReview.length > 0) {
					// fetch all parallel resource ids from org which is open to all
					const parallelResourcesIds = await this.findParallelResources(
						organization_id,
						resourceTypesInParallelReview
					)
					// add the resource ids in the final array
					finalResourceIds = [...finalResourceIds, ...parallelResourcesIds]
				}

				const assignedToMe = await this.findResourcesAssignedToReviewer(uniqueOrganizationIds, user_id)

				finalResourceIds = [...finalResourceIds, ...assignedToMe]

				finalResourceIds = _.difference(
					utils.getUniqueElements(finalResourceIds),
					utils.getUniqueElements(resourceIdsToBeRemoved)
				)
			}

			if (finalResourceIds.length === 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCE_LISTED_SUCCESSFULLY',
					result,
				})
			}

			const resourceFilter = {
				organization_id: { [Op.in]: uniqueOrganizationIds },
				id: { [Op.in]: finalResourceIds },
				user_id: {
					[Op.notIn]: [user_id],
				},
			}
			if (searchText != '')
				resourceFilter.title = {
					[Op.iLike]: '%' + searchText + '%',
				}

			if (common.TYPE in queryParams && queryParams[common.TYPE]) {
				resourceFilter.type = queryParams[common.TYPE].split(',')
			}

			const response = await resourceQueries.resourceList(
				resourceFilter,
				[
					'id',
					'title',
					'type',
					'organization_id',
					'status',
					'user_id',
					'submitted_on',
					'last_reviewed_on',
					'created_at',
					'meta',
				],
				sort,
				page,
				limit
			)

			if (response.length === 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCE_LISTED_SUCCESSFULLY',
					result,
				})
			}

			const uniqueCreatorIds = utils.getUniqueElements(
				response.result.map((item) => {
					return item.user_id
				})
			)

			const userDetails = await this.fetchUserDetails(uniqueCreatorIds)
			const orgDetails = await this.fetchOrganizationDetails(uniqueOrganizationIds)

			result.data = response.result.map((item) => {
				let returnValue = item

				if (item.meta?.notes) returnValue.notes = item.meta.notes
				if (inProgressResources.includes(item.id)) {
					returnValue.reviewer_status = common.REVIEW_STATUS_INPROGRESS
				}
				returnValue.creator =
					userDetails[item.user_id] && userDetails[item.user_id].name ? userDetails[item.user_id].name : ''
				returnValue.organization = orgDetails[item.organization_id]
				delete item.user_id
				delete item.organization_id
				delete returnValue.meta
				return returnValue
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
	 * Get all sequential resources from an organization based on the roles of the user.
	 * @name findSequentialResources
	 * @param {String} organization_id -  organization_id.
	 * @param {Array} roles -  roles of the logged in user.
	 * @param {Array} resourceTypes -  resourceTypes which are in sequential review in the org.
	 * @returns {Array} - Response contain array of resource ids
	 */

	static async findSequentialResources(organization_id, roles, resourceTypes = []) {
		// get unique user roles
		const userRoleTitles = utils.getUniqueElements(roles.map((item) => item.title))

		// fetch the resource wise review levels
		const resourceWiseLevels = await this.fetchResourceReviewLevel(organization_id, userRoleTitles, resourceTypes)
		let resourceTypeStagesConfig = []
		resourceTypes.filter((type) => {
			if (resourceWiseLevels[type]) {
				resourceTypeStagesConfig.push({
					[Op.and]: [{ type: type }, { next_stage: resourceWiseLevels[type] }],
				})
			}
		})
		const resourceFilter = {
			organization_id,
			[Op.or]: resourceTypeStagesConfig,
			status: { [Op.in]: [common.RESOURCE_STATUS_SUBMITTED, common.RESOURCE_STATUS_IN_REVIEW] },
		}
		const resourcesDetails = await resourceQueries.findAll(resourceFilter, ['id'])
		let resoureId = []
		if (resourcesDetails) {
			resoureId = resourcesDetails.map((item) => {
				return item.id
			})
		}
		return resoureId
	}

	/**
	 * Get all parallel resources from an organization.
	 * @name findParallelResources
	 * @param {String} organization_id -  organization_id.
	 * @param {Array} resourceTypes -  resourceTypes which are in parallel review in the org.
	 * @returns {Array} - Response contain array of resource ids
	 */
	static async findParallelResources(organization_id, resourceTypes = []) {
		const resourceFilter = {
			organization_id,
			type: {
				[Op.in]: resourceTypes,
			},
			status: { [Op.in]: [common.RESOURCE_STATUS_SUBMITTED, common.RESOURCE_STATUS_IN_REVIEW] },
		}
		let resoureId = []
		const resourcesDetails = await resourceQueries.findAll(resourceFilter, ['id'])
		if (resourcesDetails) {
			resoureId = resourcesDetails.map((item) => {
				return item.id
			})
		}
		return resoureId
	}
	/**
	 * Get all resources assigned to the reviewer
	 * @name findResourcesAssignedToReviewer
	 * @param {Array} organization_ids -  list of organization_ids.
	 * @param {String} logged_in_user_id -  user id of the logged in user
	 * @returns {Array} - Response contain array of resource ids
	 */
	static async findResourcesAssignedToReviewer(organization_ids, logged_in_user_id) {
		const reviewsFilter = {
			organization_id: { [Op.in]: organization_ids },
			reviewer_id: logged_in_user_id,
			status: { [Op.in]: common.REVIEW_STATUS_UP_FOR_REVIEW },
		}

		let res = []

		const reviewsResponse = await reviewsQueries.findAll(reviewsFilter, ['resource_id'])
		res = reviewsResponse.map((item) => {
			return item.resource_id
		})
		return res
	}
	/**
	 * Get all resources assigned to the reviewer and already picked up by other reviewer
	 * @name findResourcesPickedUpByAnotherReviewer
	 * @param {String} loggedInUserId -  user id of the logged in user.
	 * @param {Array} openToAllResourcesMatchingMyLevel -  list of resources matching to reviewer's level.
	 * @returns {Array} - Response contain array of resource ids to be removed from the main response
	 */
	static async findResourcesPickedUpByAnotherReviewer(loggedInUserId, openToAllResourcesMatchingMyLevel) {
		// remove all the resouces in sequential review picked up by another reviewer
		const reviewsFilter = {
			resource_id: { [Op.in]: openToAllResourcesMatchingMyLevel },
			status: {
				[Op.in]: [
					common.REVIEW_STATUS_INPROGRESS,
					common.REVIEW_STATUS_CHANGES_UPDATED,
					common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
					common.RESOURCE_STATUS_STARTED,
				],
			},
			reviewer_id: { [Op.notIn]: [loggedInUserId] },
		}
		const reviewsResponse = await reviewsQueries.findAll(reviewsFilter, ['resource_id'])
		let resourceIdsToBeRemoved = []
		if (reviewsResponse) {
			// push resource ids to resourceIdsToBeRemoved array
			resourceIdsToBeRemoved = reviewsResponse.map((item) => item.resource_id)
			return resourceIdsToBeRemoved
		}
		return resourceIdsToBeRemoved
	}

	/**
	 * Get all review levels from the reviews table
	 * @name fetchResourceReviewLevel
	 * @param {String} organization_id - organization_id of the logged in user.
	 * @param {Array} userRoleTitles -  list of user role titles.
	 * @param {Array} resourceTypeList -  list of resource types.
	 * @returns {Object} - Response contain object , Ex
	 * {
	 * 	project : 1,
	 * 	observation : 4
	 * }
	 */
	static async fetchResourceReviewLevel(organization_id, userRoleTitles, resourceTypeList) {
		// fetch review levels according to roles in the organization
		const reviewLevelDetails = await reviewStagesQueries.findAll(
			{
				organization_id,
				role: {
					[Op.in]: userRoleTitles,
				},
				resource_type: {
					[Op.in]: resourceTypeList,
				},
			},
			{ attributes: ['resource_type', 'level'], order: [['level', 'ASC']] }
		)
		let resourceWiseLevels = {}

		if (reviewLevelDetails) {
			// arrange it as a key-value pair for ease of use
			resourceWiseLevels = reviewLevelDetails.reduce((acc, item) => {
				acc[item.resource_type] = item.level

				return acc
			}, {})
		}
		return resourceWiseLevels
	}

	/**
	 * Get all the resources types of an organization
	 * @name fetchResourceReviewTypes
	 * @param {String} organization_id - organization_id of the logged in user.
	 * @returns {Object} - Response contain object , with list of sequential and parallel resource types
	 */
	static async fetchResourceReviewTypes(organization_id) {
		try {
			// Fetch organization-based configurations for resources
			const configList = await configs.list(organization_id)

			// Map resource types to their review types
			const resourceWiseReviewType = configList.result.resource.reduce((acc, item) => {
				acc[item.resource_type] = item.review_type
				return acc
			}, {})

			let resourceTypesInSequentialReview = []
			let resourceTypesInParallelReview = []

			for (const [key, value] of Object.entries(resourceWiseReviewType)) {
				value === common.REVIEW_TYPE_SEQUENTIAL
					? resourceTypesInSequentialReview.push(key)
					: resourceTypesInParallelReview.push(key)
			}

			// Return the categorized resource types
			return {
				sequential: resourceTypesInSequentialReview,
				parallel: resourceTypesInParallelReview,
			}
		} catch (error) {
			throw error
		}
	}
	/**
	 * Get all the resources which are review in progress
	 * @name fetchReviewersInprogressResources
	 * @param {String} user_id - user_id of the logged in user.
	 * @param {Array} uniqueOrganizationIds - uniqueOrganizationIds of the logged in user.
	 * @returns {Object} - Response contain object of resources
	 */
	static async fetchReviewersInprogressResources(user_id, uniqueOrganizationIds) {
		// fetch resources under user id from the org which are review inProgress and changes updated by creator
		const filter = {
			organization_id: { [Op.in]: uniqueOrganizationIds },
			reviewer_id: user_id,
			status: { [Op.in]: [common.REVIEW_STATUS_INPROGRESS, common.REVIEW_STATUS_CHANGES_UPDATED] },
		}
		let result = await reviewsQueries.findAll(filter, ['resource_id', 'organization_id'])
		return result
	}

	/**
	 * Get all the reviewer notes for the resources
	 * @name fetchReviewerNotesForResources
	 * @param {String} reviewer_id - user_id of the logged in user.
	 * @param {Array} resource_ids - array of resource_ids.
	 * @param {Array} organization_ids - list of organization_ids.
	 * @returns {Object} - Response contain object of resources ids and notes
	 */

	static async fetchReviewerNotesForResources(reviewer_id = null, resource_ids, organization_ids) {
		let filter = {
			organization_id: { [Op.in]: organization_ids },
			resource_id: { [Op.in]: resource_ids },
		}
		let notes = {}
		reviewer_id ? (filter.reviewer_id = reviewer_id) : ''
		const review_notes = await reviewsQueries.findAll(filter, ['resource_id', 'notes'])
		if (review_notes) {
			notes = review_notes.reduce((acc, item) => {
				acc[item.resource_id] = item.notes
				return acc
			}, {})
		}
		return notes
	}

	/**
	 * Get all details of users from the user service.
	 * @name fetchUserDetails
	 * @param {Array} userIds - array of userIds.
	 * @returns {Object} - Response contain object of user details
	 */
	static async fetchUserDetails(userIds) {
		const userDetailsResponse = await userRequests.list(common.FILTER_ALL.toLowerCase(), '', '', '', '', {
			user_ids: userIds,
		})
		let userDetails = {}
		if (userDetailsResponse.success && userDetailsResponse.data?.result?.data?.length > 0) {
			userDetails = _.keyBy(userDetailsResponse.data.result.data, 'id')
		}
		return userDetails
	}

	/**
	 * Get all details of org from the user service.
	 * @name fetchOrganizationDetails
	 * @param {Array} organization_ids - array of organization_ids.
	 * @returns {Object} - Response contain object of org details
	 */
	static async fetchOrganizationDetails(organization_ids) {
		const orgDetailsResponse = await userRequests.listOrganization(organization_ids)
		let orgDetails = {}
		if (orgDetailsResponse.success && orgDetailsResponse.data?.result?.length > 0) {
			orgDetails = _.keyBy(orgDetailsResponse.data.result, 'id')
		}
		return orgDetails
	}

	/**
	 * Upload to cloud
	 * @method
	 * @name uploadToCloud
	 * @param {Integer} resourceId - resource id
	 * @param {String} loggedInUserId - logged in user id
	 * @param {String} resourceType - resource type
	 * @param {String} fileName - fileName
	 * @param {Object} bodyData - bodyData
	 * @returns {JSON} - upload  response.
	 */

	static async uploadToCloud(fileName, resourceId, resourceType, loggedInUserId, bodyData) {
		try {
			//sample blob path
			// resource/162/6/06f444d0-03e1-4c36-92a4-78f27c18caf6/162624project.json
			let getSignedUrl = await filesService.getSignedUrl(
				{ [resourceId]: { files: [fileName] } },
				resourceType,
				loggedInUserId
			)

			const url = getSignedUrl.result[resourceId].files[0].url
			const blobPath = getSignedUrl.result[resourceId].files[0].file

			let config = {
				method: 'put',
				maxBodyLength: utils.convertToInteger(process.env.MAX_BODY_LENGTH_FOR_UPLOAD),
				url: url,
				headers: {
					'Content-Type': 'multipart/form-data',
				},
				data: JSON.stringify(bodyData),
			}

			let resourceUploadStatus = await axios.request(config)
			return {
				blob_path: blobPath,
				result: resourceUploadStatus,
			}
		} catch (error) {
			throw error
		}
	}
}

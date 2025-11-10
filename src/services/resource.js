/**
 * name : services/resource.js
 * author : Adithya Dinesh
 * Date : 04-June-2024
 * Description : Resource Service
 */
const httpStatusCode = require('@generics/http-status')
const resourceQueries = require('@database/queries/resources')
const reviewsQueries = require('@database/queries/reviews')
const reviewStagesQueries = require('@database/queries/reviewStage')
const responses = require('@helpers/responses')
const common = require('@constants/common')
const userRequests = require('@requests/user')
const _ = require('lodash')
const utils = require('@generics/utils')
const axios = require('axios')
const filesService = require('@services/files')
const orgExtensionService = require('@services/organization-extension')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const commentQueries = require('@database/queries/comments')
const programResourceMappingQueries = require('@database/queries/programResourceMapping')
const { Op, fn, col } = require('sequelize')
const orgExtension = require('@services/organization-extension')
const defaultOrgId = process.env.DEFAULT_ORGANIZATION_CODE
const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const consumptionConfig = require('@consumption/config')
const endPoints = require('@constants/endpoints')
const requests = require('@generics/requests')
const organizationConfigQueries = require('@database/queries/organizationConfig')

module.exports = class resourceHelper {
	/**
	 * List up for listAllSubmittedResources
	 * This is a creator centric API which will return the list of all the resources which are submitted for review.
	 * @method GET
	 * @name listAllSubmittedResources
	 * @param {String} userId - user id of the logged in user fetched from the token
	 * @param {String} queryParams - Additional filters can be passed , like type , status etc...
	 * @param {String} search - Partial search of the resource with title.
	 * @param {Integer} page -  Used to skip to different pages. Used for pagination . If value is not passed, by default it will be 1
	 * @param {Integer} limit -  Used to limit the data. Used for pagination . If value is not passed, by default it will be 100
	 * @returns {JSON} - List of up for review resources
	 */
	static async listAllSubmittedResources(
		userId,
		tenant_code,
		queryParams,
		searchText = '',
		page,
		limit,
		userToken = ''
	) {
		let result = {
			data: [],
			count: 0,
			changes_requested_count: 0,
		}
		let primaryFilter = {}
		let filter = {}
		// create the final filter by combining primary filters , query params and search text
		filter = await this.constructCustomFilter(primaryFilter, queryParams, searchText)
		// return a sort object with sorting parameters. if no params are provided returns {}
		const sort = await this.constructSortOptions(queryParams.sort_by, queryParams.sort_order)

		// Add id, organization_code, and status filters
		filter = {
			...filter,
			status: {
				[Op.in]: queryParams.status?.trim()
					? queryParams.status.split(',')
					: common.PAGE_STATUS_VALUES['submitted_for_review'],
			},
			is_reusable: true,
			created_by: userId,
			tenant_code,
		}

		const resourceList = await resourceQueries.resourceList(
			filter,
			[
				'id',
				'title',
				'organization_code',
				'type',
				'status',
				'stage',
				'user_id',
				'created_at',
				'updated_at',
				'submitted_on',
				'published_on',
				'last_reviewed_on',
				'meta',
				'is_under_edit',
				'published_id',
			],
			sort,
			page,
			limit,
			true
		)

		if (resourceList.count <= 0) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result,
			})
		}
		let uniqueResourceIds = []
		let OrganizationIds = []

		const resourcesCreatedByMe = resourceList.result.map((item) => {
			uniqueResourceIds.push(item.id)
			OrganizationIds.push(item.organization_code)
			return item
		})

		// get the unique organization ids from resource creator mapping table by the user
		OrganizationIds = utils.getUniqueElements(OrganizationIds)

		// get the review details of all the resources created by the logged in user
		const resourceReviews = resourcesCreatedByMe
			.flatMap((resource) => resource.reviews || [])
			.filter((review) => review != null && review.id != null)
		// fetches data from resource table with the passed filters
		const response = {
			result: resourcesCreatedByMe.map((resource) => {
				if (resource?.reviews) delete resource.reviews
				return resource
			}),
		}

		let requestedForChangesResourcesFilter = {
			created_by: userId,
			organization_code: {
				[Op.in]: OrganizationIds,
			},
			status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
			tenant_code,
		}
		if (queryParams.type && queryParams.type != '') {
			requestedForChangesResourcesFilter.type = {
				[Op.in]: queryParams.type.split(','),
			}
		}
		const requestedForChangesResources = await resourceQueries.count(requestedForChangesResourcesFilter)

		if (response.result.length <= 0) {
			result.changes_requested_count = requestedForChangesResources > 0 ? requestedForChangesResources : 0
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result,
			})
		}
		// fetch the organization details from user service
		const orgDetails = await orgExtension.fetchOrganizationDetails(OrganizationIds, tenant_code)

		// fetch all open comments for the resources which are in review
		const commentMapping = await this.fetchOpenComments(
			response.result
				.filter((resource) => resource.status === common.REVIEW_STATUS_REQUESTED_FOR_CHANGES)
				.map((resource) => resource.id)
		)

		let reviewerIds = []

		// create a mapping object for resourceId and review details to fetch the review details like reviewerId , status etc... using resource id
		// Update the reviewed_by and reviewer_notes for multiple review.
		const reviewDetailsMapping = resourceReviews.reduce((acc, item) => {
			// Initialize acc[item.resource_id] if not already present
			if (!acc[item.resource_id]) {
				acc[item.resource_id] = {
					updated_at: item.updated_at,
					created_at: item.created_at,
					status: item.status,
					reviewer_notes: item.notes,
					reviewer_id: [], // Initialize reviewer_id as an empty array
				}
			} else {
				// If the object already exists, update only the fields that are necessary
				acc[item.resource_id].updated_at = item.updated_at
				acc[item.resource_id].status = item.status
				acc[item.resource_id].reviewer_notes = item.notes
			}
			acc[item.resource_id].reviewer_id.push(item.reviewer_id)
			reviewerIds.push(item.reviewer_id)
			return acc
		}, {})

		// fetching user details from user servicecatalog. passing it as unique because there can be repeated values in reviewerIds
		const userDetails = await this.fetchUserDetails(
			utils.getUniqueElements([...response.result.map((item) => item.user_id), ...reviewerIds]),
			null,
			tenant_code,
			userToken
		)

		// fetch additional information about resource
		const additionalResourceInformation = response.result.reduce((acc, resource) => {
			let additionalData = {}
			if (reviewDetailsMapping[resource.id]) {
				if (reviewDetailsMapping[resource.id].status !== common.REVIEW_STATUS_NOT_STARTED) {
					additionalData.reviewed_by = ''
					let reviewerIds = reviewDetailsMapping[resource.id].reviewer_id
						? reviewDetailsMapping[resource.id].reviewer_id
						: []
					if (reviewerIds.length > 0) {
						reviewerIds.forEach((reviewer_id) => {
							reviewer_id = isNaN(reviewer_id) ? reviewer_id : Number(reviewer_id)
							additionalData.reviewed_by =
								additionalData.reviewed_by + userDetails[reviewer_id]?.name + ' , '
						})
						additionalData.reviewed_by = additionalData.reviewed_by.replace(/[, \s]+$/, '')
					}
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

		// generic function to merge all the collected data about the resource
		result = await this.responseBuilder(response, userDetails, orgDetails, additionalResourceInformation)
		result.count = resourceList?.count || 0
		// count of requested for changes resources
		result.changes_requested_count = requestedForChangesResources > 0 ? requestedForChangesResources : 0
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
	 * @param {String} userId - user id of the logged in user fetched from the token
	 * @param {String} queryParams - Additional filters can be passed , like type , status etc...
	 * @param {String} search - Partial search of the resource with title.
	 * @param {Integer} page -  Used to skip to different pages. Used for pagination . If value is not passed, by default it will be 1
	 * @param {Integer} limit -  Used to limit the data. Used for pagination . If value is not passed, by default it will be 100
	 * @returns {JSON} - List of drafts resources
	 */

	static async listAllDrafts(userId, queryParams, searchText = '', page, limit, userToken, org_code, tenant_code) {
		try {
			let draftResult = {
				data: [],
				count: 0,
			}
			const resourceFilter = await this.constructCustomFilter(
				{
					status: {
						[Op.in]: common.PAGE_STATUS_VALUES[common.PAGE_STATUS_DRAFTS],
					},
					created_by: userId,
					tenant_code,
				},
				queryParams,
				searchText
			)

			// return a sort object with sorting parameters. if no params are provided returns {}
			const sort = await this.constructSortOptions(queryParams.sort_by, queryParams.sort_order)

			const { count, result } = await resourceQueries.resourceList(
				resourceFilter,
				[
					'id',
					'title',
					'organization_code',
					'type',
					'status',
					'user_id',
					'created_at',
					'updated_at',
					'stage',
					'meta',
				],
				sort,
				page,
				limit,
				false
			)

			const resourcesCreatedByMe = result

			if (resourcesCreatedByMe.length <= 0) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCE_LISTED_SUCCESSFULLY',
					draftResult,
				})
			}

			// get the unique organization ids from resource creator mapping table by the user
			const OrganizationCodes = utils.getUniqueElements(
				resourcesCreatedByMe.map((item) => item.organization_code)
			)

			// fetch the user details from user service
			const userDetails = await this.fetchUserDetails([userId], org_code, tenant_code, userToken)

			// fetch the org details from user service
			const orgDetails = await orgExtension.fetchOrganizationDetails(OrganizationCodes, tenant_code)
			draftResult = await this.responseBuilder({ result: resourcesCreatedByMe }, userDetails, orgDetails, {})
			draftResult.count = count

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result: draftResult,
			})
		} catch (error) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_LISTED_SUCCESSFULLY',
				result: [],
			})
		}
	}

	/**
	 * Build response struct
	 * Description : This is the method used by the main functions to build the final output response.
	 * @name responseBuilder
	 * @param {Object} resourceDetails - Query response from resource table.
	 * @param {Object} userDetails - Key pair value of user details, fetched from user service. This object will be used by the service to fetch the user details using user id
	 * @param {Object} orgDetails  - Key pair value of org details, fetched from user service. This object will be used by the service to fetch org user details using org id
	 * @param {Object} additionalResourceInformation - If the response needs any additional information as per the products request , which is to be fetched from other tables , like reviews etc...
	 * @returns {JSON} - List of resources
	 */
	static async responseBuilder(resourceDetails, userDetails, orgDetails, additionalResourceInformation) {
		let result = {}

		result.data = resourceDetails.result.map((res) => {
			res.organization = orgDetails[res.organization_code] ? orgDetails[res.organization_code] : {}
			res.creator = userDetails[res.user_id] && userDetails[res.user_id].name ? userDetails[res.user_id].name : ''
			res.notes = res?.meta?.notes ? res.meta.notes : ''
			if (res?.type == common.RESOURCE_TYPE_PROGRAM) {
				res.start_date = res?.meta?.start_date ? res?.meta?.start_date : ''
				res.end_date = res?.meta?.end_date ? res?.meta?.end_date : ''
			}

			if (additionalResourceInformation[res.id]) {
				res = {
					...res,
					...additionalResourceInformation[res.id],
				}
			}
			delete res.user_id
			delete res.organization_code
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
	 * @param {Object} filter - Existing filters
	 * @param {Object} queryParams -  queryParams passed in the API
	 * @param {String} searchText -  Search string passed to the api
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
	 * @param {Array} resourceIds - List of resources
	 * @returns {Object} - Object of resource ids which has comments and true value.
	 */
	static async fetchOpenComments(resourceIds) {
		let programResourceObj = {}
		if (resourceIds.length > 0) {
			// fetch all the resource ids from the list of programs
			programResourceObj = await this.fetchProgramResources(resourceIds)
			// append the list of resources with in program
			if (programResourceObj.reourcesWithInProgram.length > 0)
				resourceIds = [...new Set([...resourceIds, ...programResourceObj.reourcesWithInProgram])]
		}

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

		const commentMapping = await comments.reduce((acc, item) => {
			const programIds = programResourceObj?.programResourceMapping[item.resource_id] || []
			const hasComments = parseInt(item.comment_count, 10) > 0

			if (programIds.length > 0) {
				programIds.forEach((programId) => {
					acc[programId] = hasComments
				})
			} else {
				acc[item.resource_id] = hasComments
			}

			return acc
		}, {})

		return commentMapping
	}

	/**
	 * fetch Program Resources
	 * @name fetchProgramResources
	 * @param {Array} resourceIds - List of resources
	 * @returns {Object} - Object of reourcesWithInProgram and programResourceMapping
	 * {
	 * 		reourcesWithInProgram : [ list of reources / solutions with in the passed program ids] ,
	 * 		programResourceMapping : { obj of resource id with an array of program id  }
	 *  }
	 */

	static async fetchProgramResources(resourceIds) {
		{
			// fetch all program details from the resource id list
			const fetchProgramIds = await resourceQueries.findAll(
				{
					id: {
						[Op.in]: resourceIds,
					},
					type: common.RESOURCE_TYPE_PROGRAM,
				},
				['id']
			)
			// seggregate program ids from the db response to an array
			const programIds = fetchProgramIds.map((program) => program.id) || []
			if (programIds.length === 0) {
				return { reourcesWithInProgram: [], programResourceMapping: {} }
			}

			// fetch the resources mapped to the program
			const fetchProgramResourceMapping = await programResourceMappingQueries.findAll(
				{
					program_id: {
						[Op.in]: programIds,
					},
				},
				['program_id', 'resource_id']
			)
			// get the resource ids from the mapping
			const reourcesWithInProgram = fetchProgramResourceMapping.map((resource) => resource.resource_id) || []

			// create a mapping with resource ids and program ids
			/*
				programResourceMapping = {
					resource_id : program_id
				}
			*/
			const programResourceMapping =
				Array.isArray(fetchProgramResourceMapping) && fetchProgramResourceMapping.length > 0
					? fetchProgramResourceMapping.reduce((acc, resource) => {
							if (!acc[resource.resource_id]) {
								acc[resource.resource_id] = [] // Initialize with an empty array if the key doesn't exist
							}
							acc[resource.resource_id].push(resource.program_id)
							return acc
					  }, {})
					: {}

			return { reourcesWithInProgram, programResourceMapping }
		}
	}
	/**
	 * Generate sort filter
	 * @name constructSortOptions
	 * @param {Object} queryParams -  queryParams contain sort details like sort_by, sort_order
	 * @returns {JSON} - Response contain sort filter
	 */
	static async constructSortOptions(sort_by, sort_order, defaultSortBy = common.UPDATED_AT) {
		let sort = {}
		if (sort_by && sort_order) {
			sort.sort_by = sort_by
			sort.order =
				sort_order.toUpperCase() == common.SORT_DESC.toUpperCase() ? [common.SORT_DESC] : [common.SORT_ASC]
		} else {
			sort.sort_by = defaultSortBy
			sort.order = [common.SORT_DESC]
		}
		return sort
	}

	/**
	 * List up for review resources of reviewers
	 * Description : This is a reviewer centric API which will return the list of all the resources which the reviewer can review.
	 * 				 The list will contain all the resources the user is already reviewing  , resources which are assigned to the reviewer ,
	 * 				 sequential resources which are open to all and matching to the reviewers role level and open to all parallel review resources.
	 * @method GET
	 * @name upForReview
	 * @param {String} type (optional) -  Type of the resource. Ex : Project , Observation etc...
	 * @param {String} search (optional) -  Partial search of the resource with title.
	 * @param {String} status  (optional) - FIltered by statuses - 'INPROGRESS', 'NOT_STARTED', 'CHANGES_UPDATED', 'STARTED'
	 * @param {String} sort_by (optional) -  Column name where we should apply sort. By default it will be created_at
	 * @param {String} sort_order (optional) -  Order of the sort operation asc / desc . by default desc
	 * @param {Integer} page (optional) -  Used to skip to different pages. Used for pagination . If value is not passed, by default it will be 1
	 * @param {Integer} limit (optional) -  Used to limit the data. Used for pagination . If value is not passed, by default it will be 100
	 *
	 * @returns {JSON} - List of up for review resources
	 */
	static async upForReview(queryParams, tokenDetails, searchText = '', page, limit, userToken = '') {
		try {
			// get user details from token
			const user_id = tokenDetails.id
			const organization_code = tokenDetails.organization_code
			const tenant_code = tokenDetails.tenant_code
			const roles = tokenDetails.roles

			let result = {
				data: [],
				count: 0,
				in_progress_count: 0,
			}

			// return a sort object with sorting parameters. if no params are provided returns {}
			const sort = await this.constructSortOptions(queryParams.sort_by, queryParams.sort_order)

			let finalResourceIds = []
			let resourceIdsToBeRemoved = []
			let inProgressResources = []
			let uniqueOrganizationIds = [organization_code]

			const distinctResourceIds = await reviewsQueries.distinctResources(
				{
					reviewer_id: user_id,
					status: { [Op.in]: [common.REVIEW_STATUS_INPROGRESS] },
					tenant_code: tenant_code,
				},
				['resource_id']
			)

			inProgressResources = utils.getUniqueElements(distinctResourceIds.resource_ids)
			let inProgressCountFilter = {
				id: {
					[Op.in]: inProgressResources,
				},
				status: { [Op.in]: [common.REVIEW_STATUS_INPROGRESS] },
				tenant_code: tenant_code,
			}

			if (queryParams.type && queryParams.type != '') {
				inProgressCountFilter.type = {
					[Op.in]: queryParams.type.split(','),
				}
			}
			const in_progress_count = await resourceQueries.count(inProgressCountFilter)
			result.in_progress_count = in_progress_count
			finalResourceIds = inProgressResources

			if (!(common.STATUS in queryParams && queryParams[common.STATUS] === common.REVIEW_STATUS_INPROGRESS)) {
				// fetch the resources types of an organization based on parallel and sequential review type
				let { sequential: resourceTypesInSequentialReview, parallel: resourceTypesInParallelReview } =
					await this.fetchResourceReviewTypes(organization_code, tenant_code)

				if (common.TYPE in queryParams && queryParams[common.TYPE]) {
					let filterResourceTypes = queryParams[common.TYPE].split(',')
					// check if the type passed in the query param belongs to sequential or not.
					// if present in sequential remove all other types and add only the type passed which belongs to sequential
					resourceTypesInSequentialReview = _.filter(resourceTypesInSequentialReview, (value) =>
						_.includes(filterResourceTypes, value)
					)

					// check if the type passed in the query param belongs to parallel or not.
					// if present in parallel remove all other types and add only the type passed which belongs to parallel
					resourceTypesInParallelReview = _.filter(resourceTypesInParallelReview, (value) =>
						_.includes(filterResourceTypes, value)
					)
				}
				// if the organization have any resource type in sequential review type
				if (resourceTypesInSequentialReview.length > 0) {
					// fetch all sequential resource ids from org which are open to all
					const sequentialResourcesIds = await this.findSequentialResources(
						organization_code,
						tenant_code,
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
						organization_code,
						tenant_code,
						resourceTypesInParallelReview
					)
					// add the resource ids in the final array
					finalResourceIds = [...finalResourceIds, ...parallelResourcesIds]
				}

				const resourceReviewersDetails = await this.findResourceReviewersDetails(user_id, finalResourceIds)

				// from the parallel and sequential open to all resources , remove which are directly assigned to other reviewers
				finalResourceIds = _.difference(
					finalResourceIds,
					resourceReviewersDetails.assignedToOthers //remove resources directly assigned to other reviewers
				)

				// fetch resources directly assigned to me
				const assignedToMe = resourceReviewersDetails.assignedToMe

				finalResourceIds = [...finalResourceIds, ...assignedToMe]

				// resources reviewer have approved , rejected or requested for change should be removed from main list
				const resouecesCompletedMyReview = await this.getUserApprovedOrChangesRequestedResources(
					user_id,
					finalResourceIds
				)

				resourceIdsToBeRemoved = [...resourceIdsToBeRemoved, ...resouecesCompletedMyReview]
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

			let resourceFilter = {
				tenant_code: tenant_code,
				id: { [Op.in]: finalResourceIds },
				user_id: {
					[Op.notIn]: [user_id],
				},
				is_reusable: true,
			}
			if (common.STATUS in queryParams && queryParams[common.STATUS] === common.REVIEW_STATUS_INPROGRESS) {
				resourceFilter.status = common.REVIEW_STATUS_INPROGRESS
			} else {
				resourceFilter.status = {
					[Op.notIn]: [
						common.RESOURCE_STATUS_PUBLISHED,
						common.RESOURCE_STATUS_REJECTED,
						common.RESOURCE_STATUS_REJECTED_AND_REPORTED,
						common.RESOURCE_STATUS_DRAFT,
					],
				}
			}
			if (searchText != '')
				resourceFilter.title = {
					[Op.iLike]: '%' + searchText + '%',
				}

			if (common.TYPE in queryParams && queryParams[common.TYPE]) {
				resourceFilter.type = queryParams[common.TYPE].split(',')
			}

			// fetches data from resource table with the passed filters
			const response = await resourceQueries.resourceList(
				resourceFilter,
				[
					'id',
					'title',
					'type',
					'organization_code',
					'status',
					'stage',
					'user_id',
					'submitted_on',
					'last_reviewed_on',
					'created_at',
					'meta',
					'published_id',
					'published_on',
				],
				sort,
				page,
				limit,
				false
			)

			if (response.result.length === 0) {
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
			uniqueOrganizationIds = utils.getUniqueElements(response.result.map((item) => item.organization_code))
			const userDetails = await this.fetchUserDetails(uniqueCreatorIds, null, tenant_code, userToken)
			const orgDetails = await orgExtension.fetchOrganizationDetails(uniqueOrganizationIds, tenant_code)
			const reviewDetails = await reviewsQueries.findAll(
				{
					tenant_code,
					resource_id: {
						[Op.in]: finalResourceIds,
					},
					reviewer_id: user_id,
				},
				['resource_id', 'status']
			)

			// create a mapping object for resourceId and review status
			const reviewDetailsMapping = reviewDetails.reduce((acc, item) => {
				acc[item.resource_id] = {
					status: item.status,
				}
				return acc
			}, {})

			result.data = response.result.map((item) => {
				let returnValue = item

				if (item.meta?.notes) returnValue.notes = item.meta.notes

				//Only for program return start date and end date
				if (item.type === common.RESOURCE_TYPE_PROGRAM) {
					returnValue.start_date = item.meta?.start_date || ''
					returnValue.end_date = item.meta?.end_date || ''
				}

				// add corresponding review status. If there is no review status add not started .
				// cases when there won't be any review status will be the resources open to all in the org
				returnValue.review_status = reviewDetailsMapping[item.id]
					? reviewDetailsMapping[item.id].status
					: common.REVIEW_STATUS_NOT_STARTED

				returnValue.creator =
					userDetails[item.user_id] && userDetails[item.user_id].name ? userDetails[item.user_id].name : ''

				returnValue.organization = orgDetails[item.organization_code]
				delete item.user_id
				delete item.organization_code
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
	 * Resource Details
	 * @method
	 * @name getDetails
	 * @returns {JSON} - details of resource
	 */
	static async getDetails(resourceInfo, org_code, tenant_code, userToken = '') {
		try {
			let resource
			let result = {
				organization: {},
			}

			// if resourceInfo string then get resource details from resource table or it will already has details so we can skip DB query
			if (typeof resourceInfo === common.STRING || typeof resourceInfo === common.NUMBER) {
				resource = await resourceQueries.findOne({
					id: resourceInfo,
					organization_code: org_code,
					tenant_code: tenant_code,
				})
			} else {
				resource = resourceInfo
			}

			if (!resource?.id) {
				throw new Error('RESOURCE_NOT_FOUND')
			}

			if (resource.blob_path) {
				const response = await filesService.fetchJsonFromCloud(resource.blob_path)
				if (
					response.statusCode === httpStatusCode.ok &&
					response.result &&
					Object.keys(response.result).length > 0
				) {
					//modify the response as label value pair
					let resultData = response.result

					//get all entity types with entities
					let entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
						{
							model: common.ENTITY_TYPE_MODELS[resource.type],
							status: common.STATUS_ACTIVE,
						},
						resource.organization_code,
						resource.tenant_code,
						['id', 'value', 'label', 'has_entities']
					)

					if (entityTypes.length > 0) {
						//create label value pair map
						const entityTypeMap = entityTypes.reduce((map, type) => {
							if (type.has_entities && Array.isArray(type.entities) && type.entities.length > 0) {
								map[type.value] = type.entities
									.filter((entity) => entity.status === common.STATUS_ACTIVE)
									.map((entity) => ({ label: entity.label, value: entity.value.toLowerCase() }))
							}
							return map
						}, {})

						await Promise.all(
							entityTypes.map(async (entityType) => {
								const key = entityType.value
								// Skip the entity type if entities are not available
								if (
									entityType.has_entities &&
									entityType.entities &&
									entityType.entities.length > 0 &&
									resultData.hasOwnProperty(key) &&
									entityType.value != common.DURATION
								) {
									const value = resultData[key]
									// If the value is already in label-value pair format, skip processing
									if (utils.isLabelValuePair(value) || value === '') {
										return
									}

									// Get the entities
									const validEntities = entityTypeMap[key] || []

									if (Array.isArray(value)) {
										// Map each item in the array to a label-value pair, if it exists in validEntities
										resultData[key] = value.map((item) => {
											const match = validEntities.find(
												(entity) => entity.value === item.toLowerCase()
											)
											return match || { label: item, value: item.toLowerCase() }
										})
									} else {
										// If the value is a single item, find it in validEntities
										const match = validEntities.find(
											(entity) => entity.value === value.toLowerCase()
										)
										resultData[key] = match || { label: value, value: value.toLowerCase() }
									}
								}
							})
						)

						result = { ...result, ...resultData }
					}
				}
			}

			//get organization details
			let organizationDetails = await userRequests.fetchOrg(
				resource.organization_code,
				resource.tenant_code,
				true,
				userToken
			)
			if (organizationDetails.success && organizationDetails.data && organizationDetails.data.result) {
				resource.organization = _.pick(organizationDetails.data.result, ['id', 'name', 'code'])
			}

			//Add path in getDownloadUrl
			if (
				result.certificate &&
				result.certificate.base_template_url &&
				typeof result.certificate.base_template_url === common.OBJECT
			) {
				let getResourceCertificateurl = result.certificate.base_template_url
				let certificatesUrl = await filesService.getDownloadableUrl([getResourceCertificateurl.filePath])

				if (
					certificatesUrl &&
					certificatesUrl.statusCode === httpStatusCode.ok &&
					certificatesUrl.result &&
					certificatesUrl.result.length > 0
				) {
					result.certificate.base_template_url.url = certificatesUrl.result?.[0]?.url
				}
			}
			result = { ...result, ...resource }
			if (result.meta) {
				Object.assign(result, result.meta)
			}
			delete result.blob_path

			// to get the resource details of resources within a program
			if (resource.type === common.RESOURCE_TYPE_PROGRAM) {
				let associatedResources = await programResourceMappingQueries.findAll({
					program_id: resource.id,
					organization_code: resource.organization_code,
					tenant_code: tenant_code,
				})

				if (associatedResources.length > 0) {
					const resourceIds = associatedResources.map((resource) => resource.resource_id)

					// Use eager loading to fetch resources with their open comments in a single query
					const resources = await resourceQueries.findAllWithOpenComments({
						id: { [Op.in]: resourceIds },
						organization_code: resource.organization_code,
						tenant_code: tenant_code,
					})

					// Create a map to easily check which resources have open comments
					const resourceCommentSet = new Set(
						resources
							.filter((resource) => resource.comments && resource.comments.length > 0)
							.map((resource) => resource.id)
					)

					// Process each resource and store in result.resources
					const resourceDetailsPromises = resources.map((resource) =>
						this.getDetails(resource.id, resource.organization_code, tenant_code, userToken)
					)
					const resourceDetailsResults = await Promise.all(resourceDetailsPromises)
					result.resources = resourceDetailsResults
						.filter((resourceDetail) => resourceDetail.statusCode === httpStatusCode.ok)
						.map((resourceDetail) => ({
							...resourceDetail.result,
							link: resourceDetail?.result.link
								? `${process.env.PROJECT_DEEP_LINK_URL}${resourceDetail?.result?.link}`
								: null,
							is_comments: resourceCommentSet.has(resourceDetail.result.id),
						}))
				}
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCE_FETCHED',
				result: result,
			})
		} catch (error) {
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Get all sequential resources from an organization based on the roles of the user.
	 * @name findSequentialResources
	 * @param {String} organization_code -  organization_code.
	 * @param {Array} roles -  roles of the logged in user.
	 * @param {Array} resourceTypes -  resourceTypes which are in sequential review in the org.
	 * @returns {Array} - Response contain array of resource ids
	 */

	static async findSequentialResources(organization_code, tenant_code, roles, resourceTypes = []) {
		// get unique user roles
		const userRoleTitles = utils.getUniqueElements(roles.map((item) => item.title))

		// fetch the resource wise review levels
		const resourceWiseLevels = await this.fetchReviewLevels(
			organization_code,
			tenant_code,
			userRoleTitles,
			resourceTypes
		)
		let resourceTypeStagesConfig = []
		resourceTypes.filter((type) => {
			if (resourceWiseLevels[type]) {
				resourceTypeStagesConfig.push({
					[Op.and]: [{ type: type }, { next_stage: { [Op.in]: resourceWiseLevels[type] } }],
				})
			}
		})

		let resourceFilter = {
			organization_code,
			tenant_code,
			[Op.or]: resourceTypeStagesConfig,
			status: { [Op.in]: [common.RESOURCE_STATUS_SUBMITTED] },
			stage: common.RESOURCE_STAGE_REVIEW,
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
	 * @param {String} organization_code -  organization_code.
	 * @param {Array} resourceTypes -  resourceTypes which are in parallel review in the org.
	 * @returns {Array} - Response contain array of resource ids
	 */
	static async findParallelResources(organization_code, tenant_code, resourceTypes = []) {
		const resourceFilter = {
			organization_code,
			tenant_code,
			type: {
				[Op.in]: resourceTypes,
			},
			stage: common.RESOURCE_STAGE_REVIEW,
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
	 * Get all resources which reviewer approved and requested for changes
	 * @name getUserApprovedOrChangesRequestedResources
	 * @param {String} loggedInUserId -  user id of the logged in user.
	 * @param {Array} finalResourceIds -  list of all resources fetched to list.
	 * @returns {Array} - Response contain array of resource ids to be removed from the main response
	 */
	static async getUserApprovedOrChangesRequestedResources(loggedInUserId, finalResourceIds) {
		// remove all the resouces from list which reviewer approved and requested for changes
		const reviewsFilter = {
			resource_id: { [Op.in]: finalResourceIds },
			status: {
				[Op.in]: [common.REVIEW_STATUS_APPROVED, common.REVIEW_STATUS_REQUESTED_FOR_CHANGES],
			},
			reviewer_id: loggedInUserId,
		}
		const reviewsResponse = await reviewsQueries.findAll(reviewsFilter, ['resource_id'])
		let resourceIdsToBeRemoved = []
		if (reviewsResponse.length > 0) {
			// push resource ids to resourceIdsToBeRemoved array
			resourceIdsToBeRemoved = reviewsResponse.map((item) => item.resource_id)
			return resourceIdsToBeRemoved
		}
		return resourceIdsToBeRemoved
	}
	/**
	 * Get review details of list of resources and seggregte if its assigned to logged in user or other users.
	 * @name findResourceReviewersDetails
	 * @param {String} loggedInUserId -  user id of the logged in user.
	 * @param {Array} finalResourceIds -  list of all resources fetched to list.
	 * @returns {Array} - Response contain array of resource ids to be removed from the main response
	 */
	static async findResourceReviewersDetails(loggedInUserId, finalResourceIds) {
		// remove all the resouces in sequential review picked up by another reviewer
		const reviewsFilter = {
			resource_id: { [Op.in]: finalResourceIds },
			status: {
				[Op.in]: common.REVIEW_STATUS_UP_FOR_REVIEW,
			},
		}
		const reviewsResponse = await reviewsQueries.findAll(reviewsFilter, ['resource_id', 'status', 'reviewer_id'])
		let resourcesAssignedToOtherUsers = []
		let resourcesAssignedToLoggedInUser = []

		if (reviewsResponse.length > 0) {
			reviewsResponse.reduce((_, item) => {
				if (common.REVIEW_STATUS_UP_FOR_REVIEW.includes(item.status) && item.reviewer_id !== loggedInUserId) {
					resourcesAssignedToOtherUsers.push(item.resource_id)
				} else if (
					common.REVIEW_STATUS_UP_FOR_REVIEW.includes(item.status) &&
					item.reviewer_id === loggedInUserId
				) {
					resourcesAssignedToLoggedInUser.push(item.resource_id)
				}
			}, null)
		}
		return {
			assignedToMe: utils.getUniqueElements(resourcesAssignedToLoggedInUser),
			assignedToOthers: utils.getUniqueElements(resourcesAssignedToOtherUsers),
		}
	}

	/**
	 * Get all review levels from the reviews table
	 * @name fetchReviewLevels
	 * @param {String} organization_code - organization_code of the logged in user.
	 * @param {Array} userRoleTitles -  list of user role titles.
	 * @param {Array} resourceTypeList -  list of resource types.
	 * @returns {Object} - Response contain object , Ex
	 * {
	 * 	project : 1,
	 * 	observation : 4
	 * }
	 */
	static async fetchReviewLevels(organization_code, tenant_code, userRoleTitles, resourceTypeList) {
		// list of organizations to search in review stages
		const orgIds = organization_code == defaultOrgId ? [organization_code] : [organization_code, defaultOrgId]

		// fetch review levels according to roles and resource type in the organization
		const reviewLevelDetails = await reviewStagesQueries.findAll(
			{
				organization_code: { [Op.in]: orgIds },
				tenant_code: tenant_code,
				role: {
					[Op.in]: userRoleTitles,
				},
				resource_type: {
					[Op.in]: resourceTypeList,
				},
			},
			{ attributes: ['organization_code', 'resource_type', 'level'], order: [['level', 'ASC']] }
		)

		let resourceWiseLevels = {}

		if (reviewLevelDetails.length > 0) {
			let defaultOrgLevels = {}
			let loggedInUserOrgLevels = {}

			// seggregate review levels into default org and logged user in org
			reviewLevelDetails.map((reviewStage) => {
				if (reviewStage.organization_code == defaultOrgId) {
					if (!defaultOrgLevels[reviewStage.resource_type]) defaultOrgLevels[reviewStage.resource_type] = []
					// get the list of all the review stage level for a particular resource type in default organization
					defaultOrgLevels[reviewStage.resource_type].push(reviewStage.level)
				} else if (organization_code != defaultOrgId) {
					if (!loggedInUserOrgLevels[reviewStage.resource_type])
						loggedInUserOrgLevels[reviewStage.resource_type] = []

					// get the list of all the review stage level for a particular resource type in user organization
					loggedInUserOrgLevels[reviewStage.resource_type].push(reviewStage.level)
				}
			})
			// iterated through given resource types and pass its stages
			// if user org has stage for given resource , return that value else return from default org
			resourceTypeList.map((resourceType) => {
				resourceWiseLevels[resourceType] =
					loggedInUserOrgLevels[resourceType] && loggedInUserOrgLevels[resourceType].length > 0
						? loggedInUserOrgLevels[resourceType]
						: defaultOrgLevels[resourceType]
			})
		}

		return resourceWiseLevels
	}

	/**
	 * Get all the resources types of an organization
	 * @name fetchResourceReviewTypes
	 * @param {String} organization_code - organization_code of the logged in user.
	 * @returns {Object} - Response contain object , with list of sequential and parallel resource types
	 */
	static async fetchResourceReviewTypes(organization_code, tenant_code) {
		try {
			// Fetch organization-based configurations for resources
			const orgConfig = await orgExtensionService.getConfig(organization_code, tenant_code)

			// Map resource types to their review types
			const resourceWiseReviewType = orgConfig.result.resource.reduce((acc, item) => {
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
	 * Callback URL for Update Published Resource
	 * @method
	 * @name publishCallback
	 * @returns {JSON} - details of resource
	 */
	static async publishCallback(resourceId, publishedId, link = false) {
		try {
			let resource = await resourceQueries.updateOne(
				{
					id: resourceId,
					status: { [Op.notIn]: [common.RESOURCE_STATUS_DRAFT] },
				},
				{
					published_id: publishedId,
					published_on: new Date(),
					status: common.RESOURCE_STATUS_PUBLISHED,
					stage: common.RESOURCE_STAGE_COMPLETION,
					link: link ? link : null,
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
			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.internal_server_error,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Get all details of users from the user service.
	 * @name fetchUserDetails
	 * @param {Array} userIds - array of userIds.
	 * @returns {Object} - Response contain object of user details
	 */
	static async fetchUserDetails(userIds, organisationCode = null, tenant_code = null, userToken = '') {
		const userDetailsResponse = await userRequests.list(
			common.FILTER_ALL.toLowerCase(),
			'',
			'',
			'',
			organisationCode,
			tenant_code,
			{
				user_ids: userIds,
			},
			userToken
		)

		let userDetails = {}
		if (userDetailsResponse.success && userDetailsResponse.data?.result?.data?.length > 0) {
			userDetails = _.keyBy(userDetailsResponse.data.result.data, 'id')
		}
		return userDetails
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

	static async uploadToCloud(fileName, org_code, tenant_code, resourceId, resourceType, loggedInUserId, bodyData) {
		try {
			//sample blob path
			// resource/162/6/06f444d0-03e1-4c36-92a4-78f27c18caf6/162624project.json
			let getSignedUrl = await filesService.getSignedUrl(
				{ [resourceId]: { files: [fileName] } },
				org_code,
				tenant_code,
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

	/**
	 * Check for direct publish without review
	 * @method
	 * @name isReviewMandatory
	 * @returns {Boolean} - Review required or not
	 */
	static async isReviewMandatory(resourceType, organizationId, tenant_code) {
		const orgConfig = await orgExtensionService.getConfig(organizationId, tenant_code)
		const orgConfigList = _.reduce(
			orgConfig.result.resource,
			(acc, item) => {
				acc[item.resource_type] = item.review_required
				return acc
			},
			{}
		)

		return orgConfigList[resourceType]
	}

	/**
	 * Get resources from consumption service
	 * @name browseExistingList
	 * @param {String} organization_code - Org Id of the user
	 * @param {Array} resourceIds - Resource Ids
	 * @param {Array} userRoles - User roles,
	 * @param {Object} query - Query object passed by user
	 * @param {String} searchText - Title to search
	 * @param {Integer} pageNo -  Used to skip to different pages. Used for pagination . If value is not passed, by default it will be 1
	 * @param {Integer} pageSize -  Used to limit the data. Used for pagination . If value is not passed, by default it will be 100
	 * @returns {Object} - Response contain object of resources
	 */
	static async browseExistingList(
		organization_code,
		tenant_code,
		userRoles,
		resourceIds = [],
		query,
		searchText = '',
		pageNo,
		pageSize,
		userToken = ''
	) {
		try {
			let result = {
				data: [],
				count: 0,
			}
			// fetch all the role titles from the roles array
			const roleTitles = userRoles.map((roles) => roles.title)

			// fetch modules from role permission mapping table for the user roles
			const rolePermissionDetails = await rolePermissionMappingQueries.findAll(
				{
					role_title: {
						[Op.in]: roleTitles,
					},
				},
				['module']
			)
			// check if the user have any permissions else return empty array
			if (!rolePermissionDetails || rolePermissionDetails.length === 0)
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'RESOURCES_FETCHED',
					result,
				})

			// fetch all the modules converted by removing trailing 's'
			const allowedModulesInSingular = [
				...new Set(rolePermissionDetails.map((rolesModule) => utils.convertToSingular(rolesModule.module))),
			]
			// all the resource types supported by the system
			const allResources = process.env.RESOURCE_TYPES.split(',') || []
			// fetch all the allowed resource types based on user role
			const allowedResources = allResources.filter((resource) => allowedModulesInSingular.includes(resource))

			// construct user resource type based on query param
			const resourceType = query[common.TYPE]
				? query[common.TYPE].split(',').filter((type) => allowedResources.includes(type))
				: allowedResources
			const search = searchText != '' ? searchText : ''
			let filterQuery = {
				// organization_code,
				tenant_code: tenant_code,
				status: common.RESOURCE_STATUS_PUBLISHED,
				is_reusable: true,
			}
			// construct sort object
			const sort = await this.constructSortOptions(query.sort_by, query.sort_order, common.UPDATED_AT)
			if (resourceType)
				filterQuery.type = {
					[Op.in]: resourceType,
				}
			if (search) {
				filterQuery.title = {
					[Op.iLike]: `%${search}%`,
				}
			}

			if (resourceIds.length > 0) {
				filterQuery.id = {
					[Op.in]: resourceIds,
				}
				delete filterQuery.is_reusable
			}

			let getOrgPolicies = await organizationConfigQueries.findAll(
				{
					organization_code: organization_code,
					tenant_code: tenant_code,
				},
				['organization_code', 'external_resource_visibility_policy', 'resource_visibility_policy']
			)
			// get orgPolicies filter for the organization
			const orgPoliciesFilter = this.applyOrgVisibilityPolicy(getOrgPolicies, organization_code, filterQuery)

			if (!orgPoliciesFilter.success) {
				return responses.failureResponse({
					message: orgPoliciesFilter.message || 'ORG_POLICY_APPLICATION_FAILED',
					statusCode: httpStatusCode.internal_server_error,
					responseCode: 'SERVER_ERROR',
					result: { data: [], count: 0 },
				})
			}

			filterQuery = orgPoliciesFilter.filterQuery

			const internalResources = await resourceQueries.resourceList(
				filterQuery,
				['id', 'title', 'type', 'created_by', 'created_at', 'published_on', 'organization_code', 'meta'],
				sort,
				pageNo,
				pageSize,
				false
			)

			let userIds = internalResources.result.map((item) => item.created_by)
			let organizationIds = internalResources.result.map((item) => item.organization_code)
			const internalResourcesIds = internalResources.result.map((item) => item.id)

			const reviewerDetails = await reviewsQueries.findAll(
				{
					resource_id: internalResourcesIds,
					status: common.REVIEW_STATUS_APPROVED,
					tenant_code: tenant_code,
				},
				['reviewer_id', 'resource_id']
			)

			const resouceReviewerMapping = _.mapValues(_.groupBy(reviewerDetails, 'resource_id'), (reviewers) =>
				reviewers.map((item) => item.reviewer_id)
			)

			userIds = [...userIds, ...reviewerDetails.map((item) => item.reviewer_id)]

			if (internalResources.result.length > 0) {
				// fetching user details from user servicecatalog. passing it as unique because there can be repeated values in reviewerIds
				const userDetails = await this.fetchUserDetails(
					utils.getUniqueElements(userIds),
					null,
					tenant_code,
					userToken
				)
				const orgDetails = await orgExtension.fetchOrganizationDetails(
					utils.getUniqueElements(organizationIds),
					tenant_code
				)
				result.count = internalResources.count
				internalResources.result.forEach((resource) => {
					resource['creator'] = userDetails[resource.created_by]?.name || ''
					resource['reviewed_by'] = (resouceReviewerMapping[resource.id] || [])
						.map((reviewer_id) => userDetails[reviewer_id]?.name || '')
						.filter(Boolean) // To remove any empty strings
						.join(' , ')
					resource['organization'] = orgDetails[resource.organization_code] || {}
					//Only for program return start date and end date
					if (resource.type === common.RESOURCE_TYPE_PROGRAM) {
						resource['start_date'] = resource.meta?.start_date || ''
						resource['end_date'] = resource.meta?.end_date || ''
					}
					delete resource.created_at
					delete resource.meta
					result.data.push(resource)
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'RESOURCES_FETCHED',
				result,
			})
		} catch (error) {
			return responses.failureResponse({
				message: 'RESOURCES_FETCHED',
				statusCode: httpStatusCode.ok,
				result: {
					data: [],
					count: 0,
				},
			})
		}
	}

	/**
	 * Builds a Sequelize filter query based on organization visibility policy.
	 * applyOrgVisibilityPolicy
	 * @param {Array} orgPolicies - Array of organization policy records.
	 * @param {String} organization_code - The current organization code.
	 * @param {Object} filterQuery - (optional) Existing filter query to extend.
	 * @returns {Object} Sequelize-compatible filterQuery object.
	 */
	static applyOrgVisibilityPolicy(orgPolicies, organization_code, filterQuery = {}) {
		try {
			if (!orgPolicies?.length) {
				filterQuery.organization_code = organization_code
				return { success: common.TRUE, filterQuery }
			}

			const orgPolicy = orgPolicies[0].external_resource_visibility_policy

			const sharedWithOrgCondition = {
				[Op.and]: [
					{ visibility: { [Op.ne]: common.VALID_POLICIES.CURRENT } },
					{ visible_to_organizations: { [Op.contains]: [organization_code] } },
				],
			}

			const ownOrgCondition = { organization_code }

			switch (orgPolicy) {
				// --------------------------------------------------------------------
				// CASE 1: CURRENT
				// --------------------------------------------------------------------
				// Fetch resources that belong ONLY to the current organization.
				// This policy is the strictest visibility level — no shared or public data.
				//--------------------------------------------------------------------
				case common.VALID_POLICIES.CURRENT:
					filterQuery.organization_code = organization_code
					break
				// --------------------------------------------------------------------
				// CASE 2: ASSOCIATED
				// --------------------------------------------------------------------
				// Fetch resources that are:
				//   1. Belonging to the current org
				//   2. Shared with the current org via "visible_to_organizations" array
				// --------------------------------------------------------------------
				case common.VALID_POLICIES.ASSOCIATED:
					filterQuery[Op.or] = [sharedWithOrgCondition, ownOrgCondition]
					break

				// --------------------------------------------------------------------
				// CASE 3: ALL
				// --------------------------------------------------------------------
				// Fetch ALL possible visible resources for the current org, including:
				//  1. Public resources (visibility = 'ALL')
				//  2. Shared resources visible to this org
				//      (visibility != 'CURRENT' AND org is in visible_to_organizations)
				//  3. Org’s own resources
				// --------------------------------------------------------------------

				case common.VALID_POLICIES.ALL:
					filterQuery[Op.or] = [
						{ visibility: common.VALID_POLICIES.ALL },
						sharedWithOrgCondition,
						ownOrgCondition,
					]
					break

				default:
					filterQuery.organization_code = organization_code
					return {
						success: common.TRUE,
						statusCode: httpStatusCode.bad_request,
						message: 'INVALID_POLICY',
						filterQuery,
					}
			}

			return { success: common.TRUE, filterQuery }
		} catch (error) {
			return {
				success: common.FALSE,
				statusCode: httpStatusCode.internal_server_error,
				message: error.message || 'POLICY_APPLICATION_ERROR',
				filterQuery,
			}
		}
	}

	/**
	 * List reviewers based on Org Id
	 * @method
	 * @name reviewerList
	 * @returns {JSON} - List of reviewers from the org
	 */

	static async reviewerList(role, user_id, organization_code, tenant_code, userToken = '', pageNo, limit) {
		try {
			let result = {
				data: [],
				count: 0,
			}

			let reviewers = await userRequests.list(
				role,
				pageNo,
				limit,
				'',
				organization_code,
				tenant_code,
				{
					excluded_user_ids: [user_id],
				},
				userToken
			)

			let userList = []

			if (!reviewers.success) {
				return responses.successResponse({
					statusCode: httpStatusCode.ok,
					message: 'REVIEWER_LIST_FETCHED_SUCCESSFULLY',
					result,
				})
			}

			//written as a beckup will remove once the user service PR merged
			if (Array.isArray(reviewers?.data?.result?.data) && reviewers.data.result.data.length > 0) {
				userList = reviewers.data.result.data
					.filter((user) => user.id != user_id)
					.map((user) => {
						return {
							id: user.id,
							email: user?.email || '',
							name: user?.name,
							username: user?.username,
							phone_code: user?.phone_code || '',
							phone: user?.phone || '',
							status: user?.status,
							organization: user?.user_organizations?.[0]?.organization || {},
							organization_code: user?.user_organizations?.[0]?.organization_code || '',
						}
					})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'REVIEWER_LIST_FETCHED_SUCCESSFULLY',
				result: {
					data: userList,
					count: userList.length,
				},
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Uploads a resource to the cloud and updates its metadata in the database.
	 * @param {string} resourceId - The ID of the resource to upload and update.
	 * @param {string} org_code - The ID of the organization associated with the resource.
	 * @param {string} loggedInUserId - The ID of the user performing the operation.
	 * @param {Object} data - The data to be uploaded to the cloud.
	 * @param {string} fileName - The name of the file to be uploaded.
	 * @param {string} resourceType - The type of the resource (e.g., 'program', 'project').
	 * @returns {Promise<void>} - Resolves when the upload and update are successful.
	 */
	static async uploadAndUpdateResource(
		resourceId,
		org_code,
		tenant_code,
		loggedInUserId,
		data,
		fileName,
		resourceType
	) {
		try {
			const uploadStatus = await this.uploadToCloud(
				fileName,
				org_code,
				tenant_code,
				resourceId,
				resourceType,
				loggedInUserId,
				data
			)

			if (
				uploadStatus.result.status === httpStatusCode.ok ||
				uploadStatus.result.status === httpStatusCode.created
			) {
				const filter = { id: resourceId, organization_code: org_code, tenant_code: tenant_code }
				const updateData = { updated_by: loggedInUserId, blob_path: uploadStatus.blob_path }
				if (data.title) {
					updateData.title = data.title
				}

				const [updateCount, updatedResource] = await resourceQueries.updateOne(filter, updateData, {
					returning: true,
					raw: true,
				})

				if (updateCount === 0) {
					throw new Error('RESOURCE_NOT_FOUND')
				}

				return updatedResource
			} else {
				throw new Error('FILE_UPLOADED_FAILED')
			}
		} catch (error) {
			throw error
		}
	}

	/**
	 * Fetch the consumption deep link for a solution
	 * @param {string} solutionId - The ID of the solution to fetch the deep link for.
	 * @param {string} solutionType - The type of the solution (e.g., 'program', 'project').
	 * @returns {Promise<Object>} - Resolves with the deep link response object.
	 */
	static async getDeepLink(solutionId, solutionType) {
		try {
			let result = {
				deepLinks: '',
			}
			const consumptionServiceUrl = consumptionConfig.fetchConsumptionServiceUrls(solutionType)
			if (!consumptionServiceUrl) {
				return responses.failureResponse({
					message: 'CONSUMPTION_LINK_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					result,
				})
			}
			const url = utils.buildUrl(consumptionServiceUrl, endPoints.FETCH_LINK_END_POINT, {}, solutionId)
			const response = await requests.get(url, '', true, 'internal-access-token')
			if (!response.success || !response.data) {
				return responses.failureResponse({
					message: 'CONSUMPTION_LINK_FETCH_FAILED',
					statusCode: httpStatusCode.internal_server_error,
				})
			}

			if (Array.isArray(response.data.result)) {
				result.deepLinks = response.data.result.join(',')
			}
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'CONSUMPTION_LINK_FETCHED',
				result,
			})
		} catch (error) {
			throw error
		}
	}
}

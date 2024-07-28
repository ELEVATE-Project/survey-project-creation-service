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
const { Op, Utils } = require('sequelize')
const utils = require('@generics/utils')
const axios = require('axios')
const utils = require('@generics/utils')
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
			let uniqueInReviewResourcesIds = []
			let reviewer_notes = {}
			let in_progress_resource_ids = {}
			let rejected_resource_ids = {}
			let rejected_and_resported_resource_ids = {}
			let showNotes = false
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
			const uniqueResourceIds = utils.getUniqueElements(
				resource_creator_mapping_data.map((item) => item.resource_id)
			)

			// get the unique organization ids from resource creator mapping table by the user
			const OrganizationIds = utils.getUniqueElements(
				resource_creator_mapping_data.map((item) => item.organization_id)
			)

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

				uniqueInReviewResourcesIds = utils.getUniqueElements(inReviewResources.map((item) => item.id))

				const fetch_resource_ids_from_reviews = await reviewsQueries.findAll(
					{
						resource_id: {
							[Op.in]: uniqueResourceIds,
						},
						status: {
							[Op.in]: [
								common.REVIEW_STATUS_INPROGRESS,
								common.REVIEW_STATUS_REJECTED,
								common.REVIEW_STATUS_REJECTED_AND_REPORTED,
							],
						},
						organization_id: {
							[Op.in]: OrganizationIds,
						},
					},
					['resource_id', 'status', 'reviewer_id', 'notes', 'created_at', 'updated_at']
				)

				fetch_resource_ids_from_reviews.forEach((item) => {
					if (item.status === common.REVIEW_STATUS_INPROGRESS) {
						// Initialize the array if it doesn't exist
						if (!in_progress_resource_ids[item.resource_id]) {
							in_progress_resource_ids[item.resource_id] = []
						}
						// Add the details to the array
						in_progress_resource_ids[item.resource_id].push({
							resource_id: item.resource_id,
							reviewer_id: item.reviewer_id,
							notes: item.notes,
							created_at: item.created_at,
						})
					} else if (item.status === common.REVIEW_STATUS_REJECTED) {
						// Initialize the array if it doesn't exist
						if (!rejected_resource_ids[item.resource_id]) {
							rejected_resource_ids[item.resource_id] = []
						}
						// Add the details to the array
						rejected_resource_ids[item.resource_id].push({
							resource_id: item.resource_id,
							reviewer_id: item.reviewer_id,
							notes: item.notes,
							rejected_at: item.updated_at,
							review_status: common.REVIEW_STATUS_REJECTED,
						})
					} else if (item.status === common.REVIEW_STATUS_REJECTED_AND_REPORTED) {
						// Initialize the array if it doesn't exist
						if (!rejected_and_resported_resource_ids[item.resource_id]) {
							rejected_and_resported_resource_ids[item.resource_id] = []
						}
						// Add the details to the array
						rejected_and_resported_resource_ids[item.resource_id].push({
							resource_id: item.resource_id,
							reviewer_id: item.reviewer_id,
							notes: item.notes,
							rejected_at: item.updated_at,
							review_status: common.REVIEW_STATUS_REJECTED_AND_REPORTED,
						})
					}
				})
				// count the number of resources with changes requested
				const findAndCount = await reviewsQueries.countDistinct({
					organization_id: {
						[Op.in]: OrganizationIds,
					},
					resource_id: {
						[Op.in]: uniqueInReviewResourcesIds,
					},
					status: common.REVIEW_STATUS_REQUESTED_FOR_CHANGES,
				})
				result.changes_requested_count = findAndCount.count

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

						changeRequestedResources = utils.getUniqueElements(
							..._.map(changeRequestedResources, 'resource_id')
						)
						filter.id = {
							[Op.in]: changeRequestedResources,
						}
						filter.status = common.RESOURCE_STATUS_IN_REVIEW
					}
				}
				reviewer_notes = await this.fetchReviewerNotesForResources(
					null,
					uniqueInReviewResourcesIds,
					OrganizationIds
				)
				showNotes = true
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
				[
					'id',
					'title',
					'type',
					'organization_id',
					'status',
					'user_id',
					'published_on',
					'submitted_on',
					'created_at',
					'updated_at',
					'last_reviewed_on',
				],
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

			const uniqueOrganizationIds = utils.getUniqueElements(resources.map((item) => item.organization_id))
			let uniqueCreatorIds = utils.getUniqueElements(resources.map((item) => item.user_id))
			let additionalResourceInformation = {}

			// Iterate over each key-value pair in the object
			for (const [key, resources] of Object.entries(in_progress_resource_ids)) {
				// Directly iterate over the array of objects associated with each key
				for (const item of resources) {
					uniqueCreatorIds.push(item.reviewer_id)
					// Initialize the array if it doesn't exist
					if (!additionalResourceInformation[item.resource_id]) {
						additionalResourceInformation[item.resource_id] = []
					}
					additionalResourceInformation[item.resource_id] = {
						reviewer_id: item.reviewer_id,
						notes: item.notes,
					}
				}
			}
			// Iterate over each key-value pair in the object
			for (const [key, resources] of Object.entries(rejected_resource_ids)) {
				// Directly iterate over the array of objects associated with each key
				for (const item of resources) {
					uniqueCreatorIds.push(item.reviewer_id)
					// Initialize the array if it doesn't exist
					if (!additionalResourceInformation[item.resource_id]) {
						additionalResourceInformation[item.resource_id] = []
					}
					additionalResourceInformation[item.resource_id] = {
						reviewer_id: item.reviewer_id,
						notes: item.notes,
						rejected_at: item.rejected_at,
						review_status: item.review_status,
					}
				}
			}
			// Iterate over each key-value pair in the object
			for (const [key, resources] of Object.entries(rejected_and_resported_resource_ids)) {
				// Directly iterate over the array of objects associated with each key
				for (const item of resources) {
					uniqueCreatorIds.push(item.reviewer_id)
					// Initialize the array if it doesn't exist
					if (!additionalResourceInformation[item.resource_id]) {
						additionalResourceInformation[item.resource_id] = []
					}
					additionalResourceInformation[item.resource_id] = {
						reviewer_id: item.reviewer_id,
						notes: item.notes,
						rejected_at: item.rejected_at,
						review_status: item.review_status,
					}
				}
			}

			const userDetails = await this.fetchUserDetails(uniqueCreatorIds)
			const orgDetails = await this.fetchOrganizationDetails(uniqueOrganizationIds)

			result.data = resources.map((res) => {
				res.organization = orgDetails[res.organization_id] ? orgDetails[res.organization_id] : {}
				res.creator =
					userDetails[res.user_id] && userDetails[res.user_id].name ? userDetails[res.user_id].name : ''

				if (showNotes) {
					res.notes = reviewer_notes[res.id] || ''
				}

				if (additionalResourceInformation[res.id]) {
					res.reviewer_name =
						userDetails[additionalResourceInformation[res.id].reviewer_id] &&
						userDetails[additionalResourceInformation[res.id].reviewer_id].name
							? userDetails[additionalResourceInformation[res.id].reviewer_id].name
							: ''
					if (common.REVIEW_COLOUMN_REJECTED_AT in additionalResourceInformation[res.id]) {
						res[common.REVIEW_COLOUMN_REJECTED_AT] =
							additionalResourceInformation[res.id][common.REVIEW_COLOUMN_REJECTED_AT]
						res[common.REVIEW_STATUS] = additionalResourceInformation[res.id][common.REVIEW_STATUS]
					}
				}
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

	static async upForReview(tokenDetails, queryParams, searchText = '', page, limit) {
		try {
			// get user details from token
			const user_id = tokenDetails.id
			const organization_id = tokenDetails
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
			let resourcesIdsNotes = {}
			let inProgressResources = []

			// fetch the resources types of an organization
			const { sequential: resourceTypesInSequentialReview, parallel: resourceTypesInParallelReview } =
				await this.fetchResourceReviewTypes(organization_id)

			// get unique user roles
			const userRoleTitles = utils.getUniqueElements(roles.map((item) => item.title))

			// get all the resource types irrespective of review type
			let all_resource_types = [...resourceTypesInSequentialReview, ...resourceTypesInParallelReview]

			// check if types filter is applied
			if (common.TYPE in queryParams && queryParams[common.TYPE]) {
				// remove all the other types if type filter is applied
				all_resource_types = [queryParams[common.TYPE]]
			}

			if (resourceTypesInSequentialReview.length > 0) {
				// fetch the resource wise review levels
				const resourceWiseLevels = await this.fetchResourceReviewLevel(
					organization_id,
					userRoleTitles,
					all_resource_types
				)
			}
			let uniqueResourceIds = []
			let uniqueOrganizationIds = [organization_id] //initialize current org id

			// check review resources and find all resources under the reviewer name.
			const reviewResources = await reviewResourcesQueries.findAll(
				{
					reviewer_id: user_id,
				},
				['resource_id', 'organization_id']
			)

			if (reviewResources.length > 0) {
				// get the unique organization ids from reviewResources table by the reviewer
				uniqueOrganizationIds = utils.getUniqueElements([
					...uniqueOrganizationIds,
					...reviewResources.map((item) => item.organization_id),
				])
			}
			let reviewsFilter = {}
			let reviewsResponse = {}

			const findAndCount = await reviewsQueries.countDistinct(
				{
					organization_id: {
						[Op.in]: uniqueOrganizationIds,
					},
					reviewer_id: user_id,
					status: { [Op.in]: [common.REVIEW_STATUS_INPROGRESS, common.REVIEW_STATUS_CHANGES_UPDATED] },
				},
				['resource_id']
			)

			const in_progress_count = findAndCount.count
			inProgressResources = utils.getUniqueElements(findAndCount.resource_ids)

			if (common.STATUS in queryParams && queryParams[common.STATUS] === common.REVIEW_STATUS_INPROGRESS) {
				const inprogressReviewsResponse = await this.fetchReviewersInprogressResources(
					user_id,
					uniqueOrganizationIds
				)

				if (inprogressReviewsResponse.length > 0) {
					// get the unique organization ids from reviews table by the reviewer
					uniqueOrganizationIds = utils.getUniqueElements(
						inprogressReviewsResponse.map((item) => item.organization_id)
					)

					// get the unique resource ids from reviews table by the reviewer
					uniqueResourceIds = utils.getUniqueElements(
						inprogressReviewsResponse.map((item) => item.resource_id)
					)
					finalResourceIds = utils.getUniqueElements(uniqueResourceIds)
				}
			} else {
				reviewsFilter = {
					reviewer_id: user_id,
					organization_id: { [Op.in]: uniqueOrganizationIds },
					status: { [Op.in]: common.PAGE_STATUS_VALUES.up_for_review },
				}

				reviewsResponse = await reviewsQueries.findAll(reviewsFilter, ['resource_id', 'organization_id'])

				if (reviewsResponse.length > 0) {
					for (const item of reviewsResponse) {
						uniqueOrganizationIdsSet.add(item.organization_id)
						uniqueResourceIdsSet.add(item.resource_id)
					}
					// get the unique organization ids from reviews table by the reviewer
					uniqueOrganizationIdsSet = utils.getUniqueElements(uniqueOrganizationIdsSet)
					// get the unique resource ids from reviews table by the reviewer
					uniqueResourceIdsSet = utils.getUniqueElements(uniqueResourceIdsSet)
				}

				// fetch all submitted and inreview resources from my orgs
				let allSequentialResourcesFromOrg = []
				let openToAllResourcesMatchingMyLevel = []
				if (resourceTypesInSequentialReview.length > 0) {
					allSequentialResourcesFromOrg = await resourceQueries.findAll(
						{
							organization_id,
							type: { [Op.in]: resourceTypesInSequentialReview },
							status: { [Op.in]: [common.RESOURCE_STATUS_SUBMITTED, common.RESOURCE_STATUS_IN_REVIEW] },
						},
						['id', 'type', 'next_stage']
					)

					openToAllResourcesMatchingMyLevel = allSequentialResourcesFromOrg.map((item) => {
						if (item.next_stage === resourceWiseLevels[item.type]) return item.id
					})
				}

				const allParallelResourcesFromOrg = await resourceQueries.findAll(
					{
						organization_id,
						type: { [Op.in]: _.difference(resourceTypesInParallelReview, allSequentialResourcesFromOrg) },
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
					utils.getUniqueElements([
						...uniqueResourceIds,
						...openToAllResourcesMatchingMyLevel,
						...allParallelResourceIdsFromOrg,
					]),
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

			if (common.TYPE in queryParams && queryParams[common.TYPE]) {
				resourceFilter.type = queryParams[common.TYPE]
			}

			const response = await resourceQueries.resourceList(
				resourceFilter,
				['id', 'title', 'type', 'organization_id', 'status', 'user_id', 'submitted_on', 'last_reviewed_on'],
				sort,
				page,
				limit
			)
			const uniqueCreatorIds = response.result.map((item) => {
				return item.user_id
			})

			const userDetails = await this.fetchUserDetails(uniqueCreatorIds)
			const orgDetails = await this.fetchOrganizationDetails(uniqueOrganizationIds)

			resourcesIdsNotes = await this.fetchReviewerNotesForResources(
				user_id,
				finalResourceIds,
				uniqueOrganizationIds
			)

			result.data = response.result.map((item) => {
				let returnValue = item
				returnValue.notes = resourcesIdsNotes[item.id] || ''
				returnValue.inprogress = inProgressResources.includes(item.id)
				returnValue.creator =
					userDetails[item.user_id] && userDetails[item.user_id].name ? userDetails[item.user_id].name : ''
				returnValue.organization = orgDetails[item.organization_id]
				delete item.user_id
				delete item.organization_id
				return returnValue
			})
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

	// this function fetches review levels from the reviews table for
	// an organization, roles and resouce type and returns this as an object
	// Ex : this function returns
	// {
	// 	project : 1,
	// 	observation : 4
	// }
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
		// arrange it as a key-value pair for ease of use
		const resourceWiseLevels = reviewLevelDetails.reduce((acc, item) => {
			acc[item.resource_type] = item.level

			return acc
		}, {})

		return resourceWiseLevels || {}
	}
	// fetch the resources types of an organization
	static async fetchResourceReviewTypes(organization_id) {
		try {
			// Fetch organization-based configurations for resources
			const configList = await configs.list(organization_id)

			// Map resource types to their review types
			const resourceWiseReviewType = configList.result.reduce((acc, item) => {
				acc[item.resource_type] = item.review_type
				return acc
			}, {})

			let resourceTypesInSequentialReview = []
			let resourceTypesInParallelReview = []

			for (const [key, value] of Object.entries(resourceWiseReviewType)) {
				if (value === common.REVIEW_TYPE_SEQUENTIAL) {
					resourceTypesInSequentialReview.push(key)
				} else if (value === common.REVIEW_TYPE_PARALLEL) {
					resourceTypesInParallelReview.push(key)
				}
			}

			// Return the categorized resource types
			return {
				sequential: resourceTypesInSequentialReview,
				parallel: resourceTypesInParallelReview,
			}
		} catch (error) {
			console.error('Error fetching resource review types:', error)
			throw error
		}
	}

	static async fetchReviewersInprogressResources(user_id, uniqueOrganizationIds) {
		// fetch resources under user id from the org which are review inProgress and changes updated by creator
		const filter = {
			reviewer_id: user_id,
			organization_id: { [Op.in]: uniqueOrganizationIds },
			status: { [Op.in]: [common.REVIEW_STATUS_INPROGRESS, common.REVIEW_STATUS_CHANGES_UPDATED] },
		}
		let result = await reviewsQueries.findAll(filter, ['resource_id', 'organization_id'])
		return result
	}

	static async fetchReviewerNotesForResources(reviewer_id = null, resourceIds, organization_ids) {
		let filter = {
			resource_id: { [Op.in]: resourceIds },
			organization_id: { [Op.in]: organization_ids },
		}
		reviewer_id ? (filter.reviewer_id = reviewer_id) : ''
		const review_notes = await reviewsQueries.findAll(filter, ['resource_id', 'notes'])
		let notes = review_notes.reduce((acc, item) => {
			acc[item.resource_id] = item.notes
			return acc
		}, {})

		return notes || {}
	}

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

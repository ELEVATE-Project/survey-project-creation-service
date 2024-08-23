/**
 * name : resource.js
 * author : Adithya Dinesh
 * created-date : 29-May-2024
 * Description : Resource Controller.
 */

// Dependencies
const resourceService = require('@services/resource')
const common = require('@constants/common')

module.exports = class Resource {
	/**
	 * get resource list
	 * @method
	 * @name list
	 * @param {Object} req - request data.
	 * @returns {JSON} - resource list
	 */

	async list(req) {
		try {
			let resourceList = {}
			if (req.query[common.LISTING] === common.PAGE_STATUS_DRAFTS) {
				resourceList = await resourceService.listAllDrafts(
					req.decodedToken.id,
					req.query,
					req.searchText,
					req.pageNo,
					req.pageSize
				)
			} else if (req.query[common.LISTING] === common.PAGE_STATUS_SUBMITTED_FOR_REVIEW) {
				resourceList = await resourceService.listAllSubmittedResources(
					req.decodedToken.id,
					req.query,
					req.searchText,
					req.pageNo,
					req.pageSize
				)
			}
			return resourceList
		} catch (error) {
			return error
		}
	}

	/**
	 * get up for review resource list
	 * @method
	 * @name upForReview
	 * @param {Object} req - request data.
	 * @returns {JSON} - resource list
	 */
	async upForReview(req) {
		try {
			const resource = await resourceService.upForReview(
				req.query,
				req.decodedToken,
				req.searchText,
				req.pageNo,
				req.pageSize
			)
			return resource
		} catch (error) {
			return error
		}
	}

	/**
	 * Callback URL for Update Published Resource
	 * @method
	 * @name publishCallback
	 * @param {Object} req - request data.
	 * @returns {JSON} - details of resource
	 */
	async publishCallback(req) {
		try {
			const resource = await resourceService.publishCallback(req.query.resource_id, req.query.published_id)
			return resource
		} catch (error) {
			throw error
		}
	}

	/**
	 * Get list of Published resources from consumption side
	 * @method
	 * @name browseExisting
	 * @param {String} req.decodedToken.organization_id - User organization id.
	 * @param {String} req.decodedToken.token - user bearer auth token
	 * @param {Object} req.query - Query object passed
	 * @param {String} req.searchText - Search text passed
	 * @param {Integer} pageNo -  Used to skip to different pages. Used for pagination . If value is not passed, by default it will be 1
	 * @param {Integer} pageSize -  Used to limit the data. Used for pagination . If value is not passed, by default it will be 100
	 * @returns {JSON} - List of resources
	 */
	async browseExisting(req) {
		try {
			const resource = await resourceService.browseExistingList(
				req.decodedToken.organization_id,
				req.decodedToken.token,
				req.query,
				req.searchText,
				req.pageNo,
				req.pageSize
			)
			return resource
		} catch (error) {
			throw error
		}
	}
}

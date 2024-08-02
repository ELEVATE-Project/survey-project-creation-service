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
	 * @returns {JSON} - project details
	 */

	async list(req) {
		try {
			let resourceList = {}
			if (req.query[common.PAGE_STATUS] === common.PAGE_STATUS_DRAFTS) {
				resourceList = await resourceService.listAllDrafts(
					req.decodedToken.id,
					req.query,
					req.searchText,
					req.pageNo,
					req.pageSize
				)
			} else if (req.query[common.PAGE_STATUS] === common.PAGE_STATUS_SUBMITTED_FOR_REVIEW) {
				resourceList = await resourceService.listAllSubmittedResources(
					req.decodedToken.id,
					req.query,
					req.searchText,
					req.pageNo,
					req.pageSize
				)
			}
			// const project = await resourceService.list(
			// 	req.decodedToken.id,
			// 	req.decodedToken.organization_id,
			// 	req.query,
			// 	req.searchText,
			// 	req.pageNo,
			// 	req.pageSize
			// )
			return resourceList
		} catch (error) {
			return error
		}
	}
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
}

/**
 * name : targeting.js
 * author : Adithya Dinesh
 * created-date : 23-OCT-2025
 * Description : Targeting Controller.
 */

// Dependencies
const resourceService = require('@services/resource')
const common = require('@constants/common')

module.exports = class Resource {
	/**
	 * entity
	 * @method
	 * @name list
	 * @param {Object} req - request data.
	 * @returns {JSON} - resource list
	 */

	async entityTargeting(req) {
		try {
			let resourceList = {}
			if (req.query[common.LISTING] === common.PAGE_STATUS_DRAFTS) {
				resourceList = await resourceService.listAllDrafts(
					req.decodedToken.id,
					req.query,
					req.searchText,
					req.pageNo,
					req.pageSize,
					req.decodedToken.token,
					req.decodedToken.organization_code,
					req.decodedToken.tenant_code
				)
			} else if (req.query[common.LISTING] === common.PAGE_STATUS_SUBMITTED_FOR_REVIEW) {
				resourceList = await resourceService.listAllSubmittedResources(
					req.decodedToken.id,
					req.decodedToken.tenant_code,
					req.query,
					req.searchText,
					req.pageNo,
					req.pageSize,
					req.decodedToken.token
				)
			}
			return resourceList
		} catch (error) {
			return error
		}
	}
}

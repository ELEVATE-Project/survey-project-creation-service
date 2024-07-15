/**
 * name : resource.js
 * author : Adithya Dinesh
 * created-date : 29-May-2024
 * Description : Resource Controller.
 */

// Dependencies
const resourceService = require('@services/resource')

module.exports = class Resource {
	/**
	 * get resource list
	 * @method
	 * @name list
	 * @param {Object} req - request data.
	 * @returns {JSON} - resource details
	 */

	async list(req) {
		try {
			const resources = await resourceService.list(
				req.decodedToken.id,
				req.decodedToken.organization_id,
				req.query,
				req.searchText,
				req.pageNo,
				req.pageSize
			)
			return resources
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
}

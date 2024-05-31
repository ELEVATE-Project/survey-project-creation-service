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
	 * @returns {JSON} - project details
	 */

	async list(req) {
		try {
			const project = await resourceService.list(req.decodedToken.id, req.query, req.pageNo, req.pageSize)
			return project
		} catch (error) {
			return error
		}
	}
}

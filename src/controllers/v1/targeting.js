/**
 * name : targeting.js
 * author : Adithya Dinesh
 * created-date : 23-OCT-2025
 * Description : Targeting Controller.
 */

// Dependencies
const targetingService = require('@services/targeting')

module.exports = class Resource {
	/**
	 * Hierarchy Based On ParentEntity
	 * @method
	 * @name hierarchy
	 * @param {Object} req - request data.
	 * @returns {JSON} - resource list
	 */

	async hierarchy(req) {
		try {
			let targetingSubEntityList = await targetingService.targetingSubEntityList(
				req.params.id,
				req.decodedToken.token
			)

			return targetingSubEntityList
		} catch (error) {
			return error
		}
	}
	/**
	 * Get list of sub entities based on parent entities and sub entity type
	 * @method
	 * @name subEntityList
	 * @param {Object} req - request data
	 * @param {String} req.query.subEntityType - Type of sub entity to fetch
	 * @param {Array|String} req.body.parentEntities - List of parent entity external IDs
	 * @param {String} req.decodedToken.tenant_code - Tenant code from decoded token
	 * @param {Number} req.pageNo - Page number for pagination
	 * @param {Number} req.pageSize - Number of items per page
	 * @returns {JSON} List of sub entities with count
	 */

	async subEntityList(req) {
		try {
			let targetingSubEntityList = await targetingService.fetchDependedSubEntities(
				req.query.subEntityType,
				req?.body?.parentEntities,
				req.decodedToken.tenant_code,
				req.pageNo,
				req.pageSize
			)

			return targetingSubEntityList
		} catch (error) {
			return error
		}
	}
}

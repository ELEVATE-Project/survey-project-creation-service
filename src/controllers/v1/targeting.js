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
	 * @name hierarchyBasedOnParentEntity
	 * @param {Object} req - request data.
	 * @returns {JSON} - resource list
	 */

	async hierarchyBasedOnParentEntity(req) {
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
	 * Hierarchy Based On ParentEntity
	 * @method
	 * @name hierarchyBasedOnParentEntity
	 * @param {Object} req - request data.
	 * @returns {JSON} - resource list
	 */

	async fetchDependedSubEntities(req) {
		try {
			let targetingSubEntityList = await targetingService.fetchDependedSubEntities(
				req.query.subEntity,
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

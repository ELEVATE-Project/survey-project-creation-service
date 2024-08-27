/**
 * name : activities.js
 * author : Priyanka Pradeep
 * created-date : 18-Aug-2024
 * Description : Controller for Activities
 */

const activityService = require('@services/activities')

module.exports = class activities {
	/**
	 * Get user activities
	 * @method
	 * @name list
	 * @param {String} req.pageNo - Page No.
	 * @param {String} req.pageSize - Page size limit.
	 * @param {String} req.searchText - Search text.
	 * @returns {JSON} - activities List.
	 */

	async list(req) {
		try {
			const activities = await activityService.list(
				req.decodedToken.id,
				req.decodedToken.organization_id,
				req.pageNo,
				req.pageSize
			)
			return activities
		} catch (error) {
			return error
		}
	}
}

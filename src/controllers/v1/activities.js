/**
 * name : activities.js
 * author : Priyanka Pradeep
 * created-date : 18-Aug-2024
 * Description : Controller for Activities
 */

const activityService = require('@services/activities')
const common = require('@constants/common')
const utils = require('@generics/utils')

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
			let userId = req.decodedToken.id
			let orgId = req.decodedToken.organization_id
			if (utils.validateRoleAccess(req.decodedToken.roles, common.ADMIN_ROLE)) {
				userId = req.query.user_id ? req.query.user_id : req.decodedToken.id
				orgId = req.query.organization_id ? req.query.organization_id : req.decodedToken.id
			} else if (utils.validateRoleAccess(req.decodedToken.roles, common.ORG_ADMIN_ROLE)) {
				userId = req.query.user_id ? req.query.user_id : req.decodedToken.id
			}
			const activities = await activityService.list(userId, orgId, req.pageNo, req.pageSize)
			return activities
		} catch (error) {
			return error
		}
	}
}

/**
 * name : organization-extensions.js
 * author : Priyanka Pradeep
 * created-date : 18-June-2024
 * Description : Controller for organization details.
 */

const reviewStagesService = require('@services/review-stages')
const common = require('@constants/common')
const utils = require('@generics/utils')

module.exports = class orgExtensions {
	/**
	 * update review stage
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - review stages data
	 */

	async update(req) {
		try {
			let organization_id = req.decodedToken.organization_id
			if (utils.validateRoleAccess(req.decodedToken.roles, common.ADMIN_ROLE)) {
				organization_id = req.query.organization_id
					? req.query.organization_id
					: req.decodedToken.organization_id
			}
			const updateReviewStage = await reviewStagesService.update(req.params.id, req.body, organization_id)
			return updateReviewStage
		} catch (error) {
			return error
		}
	}

	/**
	 * list review stages in org
	 * @method
	 * @name list
	 * @param {Object} req - request data.
	 * @returns {JSON} - review stages response.
	 */

	async list(req) {
		try {
			let organization_id = req.decodedToken.organization_id
			if (utils.validateRoleAccess(req.decodedToken.roles, common.ADMIN_ROLE)) {
				organization_id = req.query.organization_id
					? req.query.organization_id
					: req.decodedToken.organization_id
			}
			const reviewStages = await reviewStagesService.list(
				req.query.resource_type ? req.query.resource_type : '',
				organization_id
			)
			return reviewStages
		} catch (error) {
			return error
		}
	}
}

/**
 * name : review-stages.js
 * author : Priyanka Pradeep
 * created-date : 29-July-2024
 * Description : Controller for review stage details.
 */

const reviewStagesService = require('@services/review-stages')
const common = require('@constants/common')
const utils = require('@generics/utils')

module.exports = class reviewStages {
	/**
	 * update review stage
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - review stages data
	 */

	async update(req) {
		try {
			const updateReviewStage = await reviewStagesService.update(
				req.params.id,
				req.body,
				req.decodedToken.organization_code,
				req.decodedToken.tenant_code
			)
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
			const reviewStages = await reviewStagesService.list(
				req.query.resource_type ? req.query.resource_type : '',
				req.decodedToken.organization_code,
				req.decodedToken.tenant_code
			)
			return reviewStages
		} catch (error) {
			return error
		}
	}
}

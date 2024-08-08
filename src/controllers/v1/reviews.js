/**
 * name : reviews.js
 * author : Priyanka Pradeep
 * created-date : 11-July-2024
 * Description : Controller for reviews
 */
const reviewService = require('@services/reviews')
module.exports = class reviews {
	/**
	 * Create or Changes requested in review
	 * @method
	 * @name update
	 * @param {Integer} id - resource id
	 * @returns {JSON} - Review creation or update details
	 */

	async update(req) {
		try {
			const updateReview = await reviewService.update(
				req.params.id, //resource id
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id
			)
			return updateReview
		} catch (error) {
			return error
		}
	}

	/**
	 * Approve the resource
	 * @method
	 * @name approve
	 * @param {Object} req - request data.
	 * @param {Integer} id - resource id
	 * @returns {JSON} - Review details
	 */

	async approve(req) {
		try {
			const updateReview = await reviewService.approveResource(
				req.params.id, //resource id
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id
			)
			return updateReview
		} catch (error) {
			return error
		}
	}

	/**
	 * Reject or Report the Resource
	 * @method
	 * @name rejectOrReport
	 * @param {Object} req - request data.
	 * @param {Integer} id - resource id
	 * @returns {JSON} - Review details
	 */

	async rejectOrReport(req) {
		try {
			const updateReview = await reviewService.rejectOrReportResource(
				req.params.id, //resource id
				req.query.isReported ? req.query.isReported : false,
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id
			)
			return updateReview
		} catch (error) {
			return error
		}
	}
}

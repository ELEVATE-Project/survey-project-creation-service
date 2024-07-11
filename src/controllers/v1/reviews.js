const reviewService = require('@services/reviews')

module.exports = class reviews {
	/**
	 * Update review status
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @param {Integer} id - resource id
	 * @returns {JSON} - Review details
	 */

	async update(req) {
		try {
			const updateReview = await reviewService.update(
				req.params.id,
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

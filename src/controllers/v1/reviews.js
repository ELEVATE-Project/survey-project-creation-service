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
			if (req.params.id) {
				const updateReview = await reviewService.update(req.body)
				return updateReview
			} else {
				const createReview = await reviewService.create(
					req.body,
					req.decodedToken.id,
					req.decodedToken.organization_id
				)
				return createReview
			}
		} catch (error) {
			return error
		}
	}
}

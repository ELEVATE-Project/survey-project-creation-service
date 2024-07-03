const common = require('@constants/common')

module.exports = {
	createConfig: (req) => {
		req.checkBody('resource_type').trim().notEmpty().withMessage('resource_type field is empty')

		// If 'review_type' is 'SEQUENTIAL', validate the 'review_stages' field
		if (req.body.review_type && req.body.review_type === common.REVIEW_TYPE_SEQUENTIAL) {
			req.checkBody('review_stages')
				.custom((value) => {
					// Check that 'review_stages' is a non-null array
					if (value === null || value === undefined || !Array.isArray(value) || !value.length > 0) {
						throw new Error('review_stages must be a non-null array')
					}
					// Check that each item in 'review_stages' is a non-null object
					if (!value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
						throw new Error('Each item in review_stages must be a non-null object')
					}
					// Check that each item in 'review_stages' has 'role' and 'level' properties
					if (!value.every((item) => item.hasOwnProperty('role') && item.hasOwnProperty('level'))) {
						throw new Error('Each item in review_stages must have role and level properties')
					}
					return true
				})
				.withMessage('Invalid review_stages')
		}
	},

	updateConfig: (req) => {
		req.checkParams('id').notEmpty().withMessage('id param is empty')
		req.checkQuery('resource_type').trim().notEmpty().withMessage('resource_type field is empty')
	},
}

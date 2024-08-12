/**
 * name : validators/v1/reviews.js
 * author : Priyanka Pradeep
 * Date : 28-July-2024
 * Description : Validations of reviews controller
 */

module.exports = {
	update: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty, please append a valid resource id')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
		req.checkBody('comment')
			.optional()
			.isArray()
			.withMessage('Comment must be an array if provided')
			.custom((comments) => {
				if (Array.isArray(comments)) {
					return comments.every(
						(commentObj) =>
							typeof commentObj === 'object' &&
							commentObj !== null &&
							commentObj.hasOwnProperty('comment') &&
							commentObj.hasOwnProperty('context') &&
							commentObj.hasOwnProperty('page')
					)
				} else {
					throw new Error('Comment must be an array of objects with "comment", "context", and "page" keys')
				}
			})
	},
	approve: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty, please append a valid resource id')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
	},
	rejectOrReport: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty, please append a valid resource id')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
		req.checkBody('comment')
			.optional()
			.isArray()
			.withMessage('Comment must be an array if provided')
			.custom((comments) => {
				if (Array.isArray(comments)) {
					return comments.every(
						(commentObj) =>
							typeof commentObj === 'object' &&
							commentObj !== null &&
							commentObj.hasOwnProperty('comment') &&
							commentObj.hasOwnProperty('context') &&
							commentObj.hasOwnProperty('page')
					)
				} else {
					throw new Error('Comment must be an array of objects with "comment", "context", and "page" keys')
				}
			})
	},
}

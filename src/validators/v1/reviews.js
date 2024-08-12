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
		req.checkBody('comment').optional()
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
	},
}

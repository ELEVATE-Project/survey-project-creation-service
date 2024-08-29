/**
 * name : validators/v1/reviews.js
 * author : Priyanka Pradeep
 * Date : 28-July-2024
 * Description : Validations of reviews controller
 */

module.exports = {
	start: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty, please append a valid resource id')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkBody('comment').optional({ checkFalsy: true })
	},
	update: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty, please append a valid resource id')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkBody('comment').optional({ checkFalsy: true })
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

		req.checkQuery('isReported')
			.trim()
			.notEmpty()
			.withMessage('resource_type field is empty')
			.isBoolean()
			.withMessage('isReported must be a boolean value')

		req.checkBody('notes')
			.optional()
			.notEmpty()
			.withMessage('notes param is empty')
			.matches(/^[A-Za-z0-9 _&<>-]+$/)
			.withMessage('notes is invalid')
	},
}

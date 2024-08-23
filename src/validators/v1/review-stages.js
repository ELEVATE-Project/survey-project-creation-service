/**
 * name : validators/v1/review-stages.js
 * author : Priyanka Pradeep
 * Date : 29-July-2024
 * Description : Validations of Review Stage controller
 */
const filterRequestBody = require('../common')
const { reviewStages } = require('@constants/blacklistConfig')

module.exports = {
	update: (req) => {
		req.body = filterRequestBody(req.body, reviewStages.update)
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkBody('role')
			.trim()
			.notEmpty()
			.withMessage('role field is empty')
			.matches(/^[a-z_-]+$/)
			.withMessage('role is invalid, must not contain spaces')

		req.checkBody('level')
			.trim()
			.notEmpty()
			.withMessage('level is empty')
			.isNumeric()
			.withMessage('level is invalid, must be an integer')
	},

	list: (req) => {
		req.checkQuery('organization_id')
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('organization_id is empty')
	},
}

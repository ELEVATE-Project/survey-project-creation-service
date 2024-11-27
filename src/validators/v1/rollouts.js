/**
 * name : validators/v1/rollouts.js
 * author : Priyanka Pradeep
 * Date : 27-Nov-2024
 * Description : Validations of rollout controller
 */
const common = require('@constants/common')
const filterRequestBody = require('../common')
const { rollouts } = require('@constants/blacklistConfig')
module.exports = {
	update: (req) => {
		req.body = filterRequestBody(req.body, rollouts.update)

		if (req.method != common.REQUEST_METHOD_DELETE) {
			req.checkBody('title').trim().notEmpty().withMessage('title is required')
		}

		req.checkParams('id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
			.isInt({ min: 1, max: 2147483647 })
			.withMessage('Id is not valid')

		req.checkParams('start_date').trim().notEmpty().withMessage('start_date param is empty')

		req.checkParams('end_date').trim().notEmpty().withMessage('end_date param is empty')

		req.checkParams('resource_id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('resource_id param is empty')
			.isNumeric()
			.withMessage('resource_id param is invalid, must be an integer')
			.isInt({ min: 1, max: 2147483647 })
			.withMessage('resource_id is not valid')
	},
}

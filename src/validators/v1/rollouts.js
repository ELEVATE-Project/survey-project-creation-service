/**
 * name : validators/v1/rollouts.js
 * author : Priyanka Pradeep
 * Date : 27-Nov-2024
 * Description : Validations of rollout controller
 */
const common = require('@constants/common')
const filterRequestBody = require('../common')
const { rollouts } = require('@constants/blacklistConfig')
const utils = require('@generics/utils')
module.exports = {
	update: (req) => {
		req.body = filterRequestBody(req.body, rollouts.update)

		if (req.method != common.REQUEST_METHOD_DELETE) {
			req.checkBody('title')
				.trim()
				.notEmpty()
				.withMessage('title is required')
				.custom((value) => {
					if (utils.validateTitle(value)) {
						throw new Error('Value exceeds the allowed length for the field title')
					}
					return true
				})
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

		req.checkBody('start_date')
			.trim()
			.notEmpty()
			.withMessage('start_date param is empty')
			.custom((value) => {
				if (req.body.end_date) {
					const startDate = new Date(req.body.start_date)
					const endDate = new Date(req.body.end_date)

					// Check if start_date is before end_date
					if (startDate >= endDate) {
						throw new Error('End date should be greater than the start date')
					}
					return true
				}
				return true
			})

		req.checkBody('end_date').trim().notEmpty().withMessage('end_date param is empty')

		req.checkBody('resource_id')
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

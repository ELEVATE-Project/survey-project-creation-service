/**
 * name : validators/v1/programs.js
 * author : Priyanka Pradeep
 * Date : 23-Jan-2025
 * Description : Validations of programs controller
 */
const common = require('@constants/common')
const filterRequestBody = require('../common')
const { programs } = require('@constants/blacklistConfig')
const utils = require('@generics/utils')
module.exports = {
	update: (req) => {
		req.body = filterRequestBody(req.body, programs.update)

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
	},
	details: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
			.isInt({ min: 1, max: 2147483647 })
			.withMessage('Id is not valid')
	},
}

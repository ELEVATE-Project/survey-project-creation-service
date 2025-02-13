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

		req.checkParams('reference_id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('reference_id param is empty')
			.isNumeric()
			.withMessage('reference_id param is invalid, must be an integer')
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
	addResources: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
			.isInt({ min: 1, max: 2147483647 })
			.withMessage('Id is not valid')

		req.checkBody('resource_ids')
			.notEmpty()
			.withMessage('resource_ids is required')
			.isArray()
			.withMessage('resource_ids must be an array')
			.custom((value) => Array.isArray(value) && value.every(Number.isInteger))
			.withMessage('resource_ids must contain only integers')

		req.checkBody()
			.custom((body) => Object.keys(body).length === 1 && 'resource_ids' in body)
			.withMessage('Body must contain only resource_ids and no other keys')
	},
	removeResources: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
			.isInt({ min: 1, max: 2147483647 })
			.withMessage('Id is not valid')

		req.checkBody('resource_ids')
			.notEmpty()
			.withMessage('resource_ids is required')
			.isArray()
			.withMessage('resource_ids must be an array')
			.custom((value) => Array.isArray(value) && value.every(Number.isInteger))
			.withMessage('resource_ids must contain only integers')

		req.checkBody()
			.custom((body) => Object.keys(body).length === 1 && 'resource_ids' in body)
			.withMessage('Body must contain only resource_ids and no other keys')
	},
}

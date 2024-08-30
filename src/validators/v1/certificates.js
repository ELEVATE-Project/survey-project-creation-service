/**
 * name : validators/v1/certificates.js
 * author : Priyanka Pradeep
 * Date : 12-Jun-2024
 * Description : Validations of certificates controller
 */
const filterRequestBody = require('../common')
const { certificates } = require('@constants/blacklistConfig')
const allowedResourceTypes = process.env.RESOURCE_TYPES.split(',')

module.exports = {
	update: (req) => {
		req.body = filterRequestBody(req.body, certificates.update)
		req.checkParams('id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkBody('code').trim().notEmpty().withMessage('code field is empty')

		req.checkBody('name').trim().notEmpty().withMessage('name field is empty')

		req.checkBody('url').trim().notEmpty().withMessage('url field is empty')

		req.checkBody('resource_type')
			.trim()
			.notEmpty()
			.withMessage('resource_type field is empty')
			.isIn(allowedResourceTypes)
			.withMessage(`resource_type is invalid, must be one of: ${allowedResourceTypes.join(', ')}`)

		req.checkBody('meta')
			.trim()
			.notEmpty()
			.withMessage('meta field is empty, Please add the logo and signature information')
	},

	list: (req) => {
		req.checkQuery('resource_id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('Resource id is empty')
			.isInt()
			.withMessage('Resource id must be an integer')
	},
}

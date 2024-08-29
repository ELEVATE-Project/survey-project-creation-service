/**
 * name : validators/v1/organization-extensions.js
 * author : Priyanka Pradeep
 * Date : 03-July-2024
 * Description : Validations of organization extension controller
 */
const filterRequestBody = require('../common')
const { organizationExtensions } = require('@constants/blacklistConfig')
const allowedResourceTypes = process.env.RESOURCE_TYPES.split(',')
module.exports = {
	createConfig: (req) => {
		req.body = filterRequestBody(req.body, organizationExtensions.createConfig)
		req.checkBody('resource_type')
			.trim()
			.notEmpty()
			.withMessage('resource_type field is empty')
			.isIn(allowedResourceTypes)
			.withMessage(`resource_type is invalid, must be one of: ${allowedResourceTypes.join(', ')}`)
	},

	updateConfig: (req) => {
		req.body = filterRequestBody(req.body, organizationExtensions.updateConfig)
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
		req.checkQuery('resource_type')
			.trim()
			.notEmpty()
			.withMessage('resource_type field is empty')
			.isIn(allowedResourceTypes)
			.withMessage(`resource_type is invalid, must be one of: ${allowedResourceTypes.join(', ')}`)

		req.checkBody('organization_id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('organization_id is empty')
	},
}

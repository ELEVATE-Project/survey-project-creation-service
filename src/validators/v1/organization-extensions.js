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
		req.checkBody('data_managers')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('data_managers field is empty')
			.matches(/^[A-Za-z]+(?:\s*,\s*[A-Za-z]+)*$/)
			.withMessage('data_managers must be a comma-separated list of alphabetic strings')
	},

	updateConfig: (req) => {
		req.body = filterRequestBody(req.body, organizationExtensions.updateConfig)
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
			.isInt({ min: 1, max: 2147483647 })
			.withMessage('Id is not valid')
		req.checkQuery('resource_type')
			.trim()
			.notEmpty()
			.withMessage('resource_type field is empty')
			.isIn(allowedResourceTypes)
			.withMessage(`resource_type is invalid, must be one of: ${allowedResourceTypes.join(', ')}`)

		req.checkBody('data_managers')
			.optional({ checkFalsy: true })
			.custom((value) => {
				// Allow empty array explicitly
				if (Array.isArray(value) && value.length === 0) {
					return true
				}

				// If it's an array, validate each element
				if (Array.isArray(value)) {
					return value.every((item) => typeof item === 'string' && /^[A-Za-z]+$/.test(item))
				}

				// If it's a string, validate the pattern
				if (typeof value === 'string') {
					return /^[A-Za-z]+(?:\s*,\s*[A-Za-z]+)*$/.test(value)
				}

				// Reject other types
				return false
			})
			.withMessage(
				'data_managers must be a comma-separated list of alphabetic strings, an array of alphabetic strings, or an empty array'
			)
		req.checkBody('organization_id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('organization_id is empty')
	},
}

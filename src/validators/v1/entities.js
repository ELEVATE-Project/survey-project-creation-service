/**
 * name : validators/v1/entities.js
 * author : Priyanka Pradeep
 * Date : 24-July-2024
 * Description : Validations of entities controller
 */
const allowedStatuses = ['ACTIVE', 'INACTIVE']
const filterRequestBody = require('../common')
const { entities } = require('@constants/blacklistConfig')
module.exports = {
	create: (req) => {
		req.body = filterRequestBody(req.body, entities.create)
		req.checkBody('value')
			.trim()
			.notEmpty()
			.withMessage('value field is empty')
			.matches(/^[A-Za-z_]+$/)
			.withMessage('value is invalid, must not contain spaces')

		req.checkBody('label')
			.trim()
			.notEmpty()
			.withMessage('label field is empty')
			.matches(/^[A-Za-z0-9 ]+$/)
			.withMessage('label is invalid')

		req.checkBody('entity_type_id')
			.notEmpty()
			.withMessage('entity_type_id field is empty')
			.isNumeric()
			.withMessage('entity_type_id is invalid, must be numeric')

		req.checkBody('status')
			.optional()
			.isIn(allowedStatuses)
			.withMessage(`status is invalid, must be one of: ${allowedStatuses.join(', ')}`)

		req.checkBody('type')
			.optional()
			.matches(/^[A-Z]+$/)
			.withMessage('type is invalid, must be in all caps and no spaces')
	},

	update: (req) => {
		req.body = filterRequestBody(req.body, entities.update)
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkBody('value')
			.optional()
			.matches(/^[A-Za-z_]+$/)
			.withMessage('value is invalid, must not contain spaces')

		req.checkBody('label')
			.optional()
			.matches(/^[A-Za-z0-9 ]+$/)
			.withMessage('label is invalid')

		req.checkBody('status')
			.optional()
			.isIn(allowedStatuses)
			.withMessage(`status is invalid, must be one of: ${allowedStatuses.join(', ')}`)

		req.checkBody('type')
			.optional()
			.matches(/^[A-Z]+$/)
			.withMessage('type is invalid, must be in all caps and no spaces')
	},

	read: (req) => {
		req.checkQuery('id')
			.trim()
			.optional()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkQuery('value')
			.trim()
			.optional()
			.notEmpty()
			.withMessage('value field is empty')
			.matches(/^[A-Za-z_]+$/)
			.withMessage('value is invalid, must not contain spaces')
	},

	delete: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
	},

	list: (req) => {
		req.checkQuery('entity_type_id')
			.trim()
			.notEmpty()
			.withMessage('entity_type_id param is empty')
			.isNumeric()
			.withMessage('entity_type_id param is invalid, must be an integer')
	},
}

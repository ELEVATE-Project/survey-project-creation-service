/**
 * name : validators/v1/entities.js
 * author : Priyanka Pradeep
 * Date : 24-July-2024
 * Description : Validations of entity-types controller
 */
const allowedStatuses = ['ACTIVE', 'INACTIVE']
module.exports = {
	create: (req) => {
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

		req.checkBody('status')
			.optional()
			.isIn(allowedStatuses)
			.withMessage(`status is invalid, must be one of: ${allowedStatuses.join(', ')}`)

		req.checkBody('data_type')
			.trim()
			.notEmpty()
			.withMessage('data_type field is empty')
			.matches(/^[A-Za-z\[\]]+$/)
			.withMessage('data_type is invalid, must not contain spaces')

		req.checkBody('allow_filtering').optional().isEmpty().withMessage('allow_filtering is not allowed in create')
	},

	update: (req) => {
		req.checkParams('id')
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkBody('value')
			.optional()
			.matches(/^[A-Za-z]+$/)
			.withMessage('value is invalid, must not contain spaces')

		req.checkBody('label')
			.optional()
			.matches(/^[A-Za-z0-9 ]+$/)
			.withMessage('label is invalid')

		req.checkBody('status')
			.optional()
			.isIn(allowedStatuses)
			.withMessage(`status is invalid, must be one of: ${allowedStatuses.join(', ')}`)

		req.checkBody('data_type')
			.trim()
			.notEmpty()
			.withMessage('data_type field is empty')
			.matches(/^[A-Za-z\[\]]+$/)
			.withMessage('data_type is invalid, must not contain spaces')
	},

	delete: (req) => {
		req.checkParams('id')
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
	},
}

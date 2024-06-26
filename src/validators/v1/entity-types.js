/**
 * name : validators/v1/entity-types.js
 * author : Ankit Shahu
 * Date : 26-Jun-2024
 * Description : Validations of entity types
 */

module.exports = {
	create: (req) => {
		req.checkBody('value')
			.trim()
			.notEmpty()
			.withMessage('value field is empty')
			.matches(/^[A-Za-z0-9_-]+$/)
			.withMessage('value is invalid')

		req.checkBody('label')
			.trim()
			.notEmpty()
			.withMessage('label field is empty')
			.matches(/^[A-Za-z0-9_-]+$/)
			.withMessage('label is invalid')

		req.checkBody('status')
			.trim()
			.notEmpty()
			.withMessage('status field is empty')
			.matches(/^[A-Za-z]+$/)
			.withMessage('status is invalid')

		req.checkBody('type')
			.trim()
			.notEmpty()
			.withMessage('type field is empty')
			.matches(/^[A-Za-z]+$/)
			.withMessage('type is invalid')

		req.checkBody('data_type')
			.trim()
			.notEmpty()
			.withMessage('data_type field is empty')
			.matches(/^[A-Za-z]+$/)
			.withMessage('data_type is invalid')

		req.checkBody('model')
			.trim()
			.notEmpty()
			.withMessage('model field is empty')
			.matches(/^[A-Za-z_-]+$/)
			.withMessage('model is invalid')
	},
}

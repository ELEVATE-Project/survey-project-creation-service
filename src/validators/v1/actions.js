/**
 * name : validators/v1/actions.js
 * author : Priyanka Pradeep
 * Date : 14-Aug-2024
 * Description : Validations of actions controller
 */

module.exports = {
	update: (req) => {
		const codeValidator = req.checkBody('code')
		const descriptionValidator = req.checkBody('description')
		if (req.param.id) {
			codeValidator.optional() // Make code optional when id is present
			descriptionValidator.optional() // Make description optional when id is present
		}

		req.checkParams('id')
			.trim()
			.optional()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		codeValidator
			.notEmpty()
			.withMessage('code field is empty')
			.matches(/^[a-zA-Z_-]+$/)
			.withMessage('code is invalid, must not contain spaces')

		descriptionValidator
			.notEmpty()
			.withMessage('description field is empty')
			.isLength({ max: 255 })
			.withMessage('description must be 255 characters or less')

		req.checkBody('status')
			.optional()
			.notEmpty()
			.withMessage('Status field must be a non-empty string when provided')
			.isIn(['ACTIVE', 'INACTIVE'])
			.withMessage('Status ' + req.body.status + ' invalid ')
	},

	delete: (req) => {
		req.checkParams('id')
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
	},
}

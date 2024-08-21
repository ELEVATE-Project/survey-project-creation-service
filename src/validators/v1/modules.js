const filterRequestBody = require('../common')
const { modules } = require('@constants/blacklistConfig')
const allowedModuleStatus = ['ACTIVE', 'INACTIVE']
module.exports = {
	create: (req) => {
		req.body = filterRequestBody(req.body, modules.create)
		req.checkBody('code')
			.trim()
			.notEmpty()
			.withMessage('code field is empty')
			.matches(/^[a-zA-Z_-]+$/)
			.withMessage('code is invalid, must not contain spaces')

		req.checkBody('status')
			.trim()
			.matches(/^[A-Za-z]*$/)
			.withMessage('status is invalid, must not contain spaces')
			.optional({ checkFalsy: true })
			.withMessage('status field must be a non-empty string when provided')
			.isIn(allowedModuleStatus)
			.withMessage(`status is invalid, must be one of: ${allowedModuleStatus.join(', ')}`)
	},

	update: (req) => {
		req.body = filterRequestBody(req.body, modules.update)
		req.checkParams('id')
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkBody('code')
			.trim()
			.notEmpty()
			.withMessage('code field is empty')
			.matches(/^[a-zA-Z_-]+$/)
			.withMessage('code is invalid, must not contain spaces')

		req.checkBody('status')
			.trim()
			.matches(/^[A-Za-z]*$/)
			.withMessage('status is invalid, must not contain spaces')
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('status field must be a non-empty string when provided')
			.isIn(allowedModuleStatus)
			.withMessage(`status is invalid, must be one of: ${allowedModuleStatus.join(', ')}`)
	},

	delete: (req) => {
		req.checkParams('id')
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
	},
}

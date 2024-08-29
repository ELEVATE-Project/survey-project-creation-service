/**
 * name : validators/v1/comments.js
 * author : Priyanka Pradeep
 * Date : 04-Jun-2024
 * Description : Validations of comment controller
 */
const allowedStatuses = ['DRAFT', 'OPEN', 'RESOLVED']
const filterRequestBody = require('../common')
const { comments } = require('@constants/blacklistConfig')

module.exports = {
	update: (req) => {
		req.body = filterRequestBody(req.body, comments.update)
		req.checkQuery('resource_id')
			.notEmpty()
			.withMessage('Resource id is empty')
			.isInt()
			.withMessage('Resource id must be an integer')

		req.checkBody('comment').optional().notEmpty().withMessage('comment param is empty')

		req.checkBody('parent_id')
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
		req.checkBody('status')
			.optional()
			.isIn(allowedStatuses)
			.withMessage(`status is invalid, must be one of: ${allowedStatuses.join(', ')}`)
		// Validate the id parameter in the URL, but it's not mandatory
		req.checkParams('id').optional().trim().isNumeric().withMessage('id param is invalid, must be an integer')

		// Custom validation: if `id` is present, ensure `comment` is an object
		if (req.params.id) {
			req.checkBody('comment', 'comment must be an object, not an array').custom((value) => {
				if (Array.isArray(value)) {
					throw new Error('comment must be an object, not an array')
				}
				return true
			})
		}
	},
	list: (req) => {
		req.checkQuery('resource_id')
			.trim()
			.notEmpty()
			.withMessage('Resource id is empty')
			.isInt()
			.withMessage('Resource id must be an integer')
	},
}

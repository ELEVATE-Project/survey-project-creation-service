/**
 * name : validators/v1/comments.js
 * author : Priyanka Pradeep
 * Date : 04-Jun-2024
 * Description : Validations of comment controller
 */
const allowedStatuses = ['DRAFT', 'OPEN', 'RESOLVED']
module.exports = {
	update: (req) => {
		req.checkQuery('resource_id')
			.notEmpty()
			.withMessage('Resource id is empty')
			.isInt()
			.withMessage('Resource id must be an integer')

		req.checkBody('comment').optional().notEmpty().withMessage('comment param is empty')

		req.checkBody('parent_id')
			.optional()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
		req.checkBody('status')
			.optional()
			.isIn(allowedStatuses)
			.withMessage(`status is invalid, must be one of: ${allowedStatuses.join(', ')}`)
	},
	list: (req) => {
		req.checkQuery('resource_id')
			.notEmpty()
			.withMessage('Resource id is empty')
			.isInt()
			.withMessage('Resource id must be an integer')
	},
}

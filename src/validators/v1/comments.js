/**
 * name : validators/v1/comments.js
 * author : Priyanka Pradeep
 * Date : 04-Jun-2024
 * Description : Validations of comment controller
 */

module.exports = {
	update: (req) => {
		req.checkQuery('resource_id')
			.notEmpty()
			.withMessage('Resource id is empty')
			.isInt()
			.withMessage('Resource id must be an integer')
	},
	list: (req) => {
		req.checkQuery('resource_id')
			.notEmpty()
			.withMessage('Resource id is empty')
			.isInt()
			.withMessage('Resource id must be an integer')
	},
}

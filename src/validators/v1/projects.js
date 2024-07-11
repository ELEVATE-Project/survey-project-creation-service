/**
 * name : validators/v1/projects.js
 * author : Priyanka Pradeep
 * Date : 28-May-2024
 * Description : Validations of projects controller
 */

module.exports = {
	details: (req) => {
		req.checkParams('id').notEmpty().withMessage('id param is empty')
	},
	update: (req) => {
		req.checkBody('title').notEmpty().withMessage('title is required')
	},
}

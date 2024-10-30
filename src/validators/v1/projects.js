/**
 * name : validators/v1/projects.js
 * author : Priyanka Pradeep
 * Date : 28-May-2024
 * Description : Validations of projects controller
 */
const common = require('@constants/common')
const filterRequestBody = require('../common')
const { projects } = require('@constants/blacklistConfig')
module.exports = {
	details: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
	},
	update: (req) => {
		req.body = filterRequestBody(req.body, projects.update)
		// Check if reference_id is passed when id is present
		if (req.params.id && req.query.reference_id) {
			throw new Error('reference_id is not allowed while updating project')
		}

		if (req.method != common.REQUEST_METHOD_DELETE) {
			req.checkBody('title').trim().notEmpty().withMessage('title is required')
		}

		req.checkParams('id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkParams('reference_id')
			.trim()
			.optional({ checkFalsy: true })
			.notEmpty()
			.withMessage('reference_id param is empty')
			.isNumeric()
			.withMessage('reference_id param is invalid, must be an integer')
	},
	submitForReview: (req) => {
		req.body = filterRequestBody(req.body, projects.submitForReview)
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')

		req.checkBody('notes').optional({ checkFalsy: true }).notEmpty().withMessage('notes is empty')

		req.checkBody('reviewer_ids')
			.optional({ checkFalsy: true })
			.isArray({ min: 1 })
			.withMessage('reviewer_ids must be a non-empty array')
			.notEmpty()
			.withMessage('reviewer_ids is empty')
	},
}

/**
 * name : projects.js
 * author : Priyanka Pradeep
 * created-date : 24-May-2024
 * Description : Project Controller.
 */

// Dependencies
const common = require('@constants/common')
const projectService = require('@services/projects')
module.exports = class Projects {
	/**
	 * create or update project details
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - project details
	 */

	async update(req) {
		try {
			if (req.params.id) {
				let project = {}
				if (req.method === common.REQUEST_METHOD_DELETE) {
					project = await projectService.delete(req.params.id, req.decodedToken.id)
				} else {
					project = await projectService.update(
						req.params.id,
						req.body,
						req.decodedToken.id,
						req.decodedToken.organization_id
					)
				}
				return project
			} else {
				const project = await projectService.create(
					req.body,
					req.decodedToken.id,
					req.decodedToken.organization_id,
					req.query.reference_id ? parseInt(req.query.reference_id) : null
				)
				return project
			}
		} catch (error) {
			return error
		}
	}
	/**
	 * get project details
	 * @method
	 * @name details
	 * @param {Object} req - request data.
	 * @returns {JSON} - project details
	 */

	async details(req) {
		try {
			const project = await projectService.details(
				req.params.id,
				req.decodedToken.organization_id,
				req.decodedToken.id
			)
			return project
		} catch (error) {
			return error
		}
	}
	/**
	 * List reviewers based on Org Id
	 * @method
	 * @name reviewerList
	 * @returns {JSON} - permissions creation object.
	 */

	async reviewerList(req) {
		try {
			const reviewerList = await projectService.reviewerList(
				req.decodedToken.id,
				req.decodedToken.organization_id,
				req.pageNo,
				req.pageSize
			)
			return reviewerList
		} catch (error) {
			return error
		}
	}

	/**
	 * submit for review
	 * @method
	 * @name submitForReview
	 * @returns {JSON} - submitted project id.
	 */

	async submitForReview(req) {
		try {
			const submitForReview = await projectService.submitForReview(req.params.id, req.body, req.decodedToken)
			return submitForReview
		} catch (error) {
			return error
		}
	}
}

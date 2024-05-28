const projectsService = require('@services/projects')

module.exports = class projects {
	/**
	 * List reviewers based on Org Id
	 * @method
	 * @name reviwerList
	 * @returns {JSON} - permissions creation object.
	 */

	async reviewerList(req) {
		try {
			const reviwerList = await projectsService.reviewerList(
				req.decodedToken.organization_id,
				req.pageNo,
				req.pageSize
			)
			return reviwerList
		} catch (error) {
			return error
		}
	}
}

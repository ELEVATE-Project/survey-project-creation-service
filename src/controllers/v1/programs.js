/**
 * name : programs.js
 * author : Priyanka Pradeep
 * created-date : 23-Jan-2025
 * Description : Programs Controller.
 */

// Dependencies
const common = require('@constants/common')
const programService = require('@services/programs')
const resourceService = require('@services/resource')
module.exports = class Programs {
	/**
	 * create or update program
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - program details
	 */

	async update(req) {
		try {
			if (req.params.id) {
				let program = {}
				if (req.method === common.REQUEST_METHOD_DELETE) {
					program = await programService.delete(req.params.id, req.decodedToken.id)
				} else {
					program = await programService.update(
						req.params.id,
						req.body,
						req.decodedToken.id,
						req.decodedToken.organization_code,
						req.query?.is_under_edit ? req.query.is_under_edit : false,
						req.decodedToken.token
					)
				}
				return program
			} else {
				const program = await programService.create(
					req.body,
					req.decodedToken.id,
					req.decodedToken.organization_code,
					req.query.reference_id ? parseInt(req.query.reference_id) : null,
					req.decodedToken.token
				)
				return program
			}
		} catch (error) {
			return error
		}
	}

	/* Details Program.
	 * @method
	 * @name details
	 * @param {Object} req  user request.
	 * @returns {JSON} - Detail of program as response.
	 */
	async details(req) {
		try {
			const rollout = await programService.details(
				req.params.id,
				req.decodedToken.organization_code,
				req.decodedToken.token
			)
			return rollout
		} catch (error) {
			return error
		}
	}

	/* add Resources to program.
	 * @method
	 * @name addResources
	 * @param {Object} req  user request.
	 * @returns {JSON} - success / error response.
	 */
	async addResources(req) {
		try {
			return await programService.addResources(
				parseInt(req.params.id),
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_code,
				req.decodedToken.token
			)
		} catch (error) {
			return error
		}
	}

	/* remove Resources from program.
	 * @method
	 * @name removeResources
	 * @param {Object} req  user request.
	 * @returns {JSON} - success / error response.
	 */
	async removeResources(req) {
		try {
			return await programService.removeResources(
				parseInt(req.params.id),
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_code
			)
		} catch (error) {
			return error
		}
	}

	/**
	 * getProgramManagers list.
	 * @method
	 * @name getProgramManagers
	 * @param {String} orgId - organization id
	 * @returns {JSON} - get the list of program managers
	 */

	async getProgramManagers(req) {
		try {
			const dataManagers = await programService.getProgramManagers(
				req.decodedToken.organization_code,
				req.pageNo,
				req.pageSize,
				req.decodedToken.token
			)
			return dataManagers
		} catch (error) {
			return error
		}
	}

	/**
	 * List reviewers based on Org Id
	 * @method
	 * @name reviewerList
	 * @returns {JSON} - reviewer list
	 */

	async reviewerList(req) {
		try {
			const reviewerList = await resourceService.reviewerList(
				process.env.DEFAULT_REVIEWER_ROLE || common.REVIEWER,
				req.decodedToken.id,
				req.decodedToken.organization_code,
				req.decodedToken.token,
				req.pageNo,
				req.pageSize
			)
			return reviewerList
		} catch (error) {
			return error
		}
	}

	/* submit program for review
	 * @method
	 * @name submitForReview
	 * @param {Object} req - user request
	 * @returns {JSON} - submitted program id.
	 */

	async submitForReview(req) {
		try {
			const submitForReview = await programService.submitForReview(
				parseInt(req.params.id),
				req.body,
				req.decodedToken
			)
			return submitForReview
		} catch (error) {
			return error
		}
	}

	/* Program publish
	 * @method
	 * @name publish
	 * @param {Object} req - user request
	 * @returns {JSON} - submitted program id.
	 */

	async publish(req) {
		try {
			const publish = await programService.publish(req.params.id, req.decodedToken)
			return publish
		} catch (error) {
			return error
		}
	}
}

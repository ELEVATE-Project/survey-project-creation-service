/**
 * name : rollouts.js
 * author : Priyanka Pradeep
 * created-date : 26-Nov-2024
 * Description : Controller for Rollouts
 */

const rolloutService = require('@services/rollouts')
const common = require('@constants/common')
module.exports = class rollouts {
	/**
	 * Create or Update Rollout.
	 * @method
	 * @name update
	 * @param {Integer} id  rollout id.
	 * @param {Object} body  rollout data
	 * @returns {JSON} - Detail of rollout as response.
	 */
	async update(req) {
		try {
			if (req.params.id) {
				let rollout = {}
				if (req.method === common.REQUEST_METHOD_DELETE) {
					rollout = await rolloutService.delete(req.params.id, req.decodedToken.id)
				} else {
					rollout = await rolloutService.update(
						req.params.id,
						req.body,
						req.decodedToken.id,
						req.decodedToken.organization_id
					)
				}
				return rollout
			} else {
				const rollout = await rolloutService.create(
					req.body,
					req.decodedToken.id,
					req.decodedToken.organization_id
				)
				return rollout
			}
		} catch (error) {
			return error
		}
	}

	/**
	 * getDataManagers list.
	 * @method
	 * @name getDataManagers
	 * @param {String} orgId - organization id
	 * @returns {JSON} - get the list of data managers
	 */

	async getDataManagers(req) {
		try {
			const dataManagers = await rolloutService.getDataManagers(
				req.decodedToken.organization_id,
				req.pageNo,
				req.pageSize
			)
			return dataManagers
		} catch (error) {
			return error
		}
	}

	/* Details Rollout.
	 * @method
	 * @name details
	 * @param {Object} req  user request.
	 * @returns {JSON} - Detail of rollout as response.
	 */
	async details(req) {
		try {
			const rollout = await rolloutService.details(
				req.params.id,
				req.decodedToken.organization_id,
				req.decodedToken.id
			)
			return rollout
		} catch (error) {
			return error
		}
	}
	/**
	 * Get Rollout List.
	 * @method
	 * @name list
	 * @param {String} organization_id
	 * @param {String} loggedInUserId
	 * @param {Object} queryParams
	 * @param {String} searchText
	 * @param {Integer} page
	 * @param {Integer} limit
	 * @returns {JSON} - Rollout list
	 */
	async list(req) {
		try {
			const rolloutList = await rolloutService.list(
				req.decodedToken.organization_id,
				req.decodedToken.id,
				req.query,
				req.searchText,
				req.pageNo,
				req.pageSize
			)

			return rolloutList
		} catch (error) {
			return error
		}
	}

	/* publish Rollout.
	 * @method GET
	 * @name publish
	 * @param {Object} req  user request.
	 * @returns {JSON} - Detail of published rollout.
	 */
	async publish(req) {
		try {
			const rollout = await rolloutService.publish(
				req.params.id,
				req.decodedToken.id,
				req.decodedToken.organization_id,
				req.userToken
			)
			return rollout
		} catch (error) {
			return error
		}
	}
}

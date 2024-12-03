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
	 * Details Rollout.
	 * @method
	 * @name details
	 * @param {Object} req  user request.
	 * @returns {JSON} - Detail of rollout as response.
	 */
	async details(req) {
		try {
			const rollout = await rolloutService.details(req.params.id, req.decodedToken.organization_id)
			return rollout
		} catch (error) {
			return error
		}
	}
}

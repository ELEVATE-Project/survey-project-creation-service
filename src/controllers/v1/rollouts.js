/**
 * name : rollouts.js
 * author : Adithya Dinesh
 * created-date : 27-November-2024
 * Description : Controller for rollouts
 */
const rolloutsService = require('@services/rollouts')
module.exports = class rollouts {
	/**
	 * Get Data managers list
	 * @method
	 * @name getDataManagers
	 * @param {Object} req - Request data.
	 * @returns {JSON} - List of data managers
	 */

	async getDataManagers(req) {
		try {
			const dataManagersList = await rolloutsService.getDataManagers(req.decodedToken.organization_id)
			return dataManagersList
		} catch (error) {
			return error
		}
	}
}

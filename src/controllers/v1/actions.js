/**
 * name : actions.js
 * author : Priyanka Pradeep
 * created-date : 14-Aug-2024
 * Description : Controller for Actions
 */

const actionService = require('@services/actions')
module.exports = class actions {
	/**
	 * Create or Update Action.
	 * @method
	 * @name update
	 * @param {Integer} id  action id.
	 * @param {Object} body  action data
	 * @returns {JSON} - Detail of action as response.
	 */
	async update(req) {
		try {
			let action
			if (req.params.id) {
				action = await actionService.update(req.params.id ? req.params.id : '', req.body)
			} else {
				action = await actionService.create(req.body)
			}

			return action
		} catch (error) {
			return error
		}
	}
}

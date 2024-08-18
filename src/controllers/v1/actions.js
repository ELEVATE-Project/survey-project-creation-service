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
				action = await actionService.update(req.params.id, req.body)
			} else {
				action = await actionService.create(req.body)
			}

			return action
		} catch (error) {
			return error
		}
	}

	/**
	 * Get all available actions
	 * @method
	 * @name list
	 * @param {String} req.pageNo - Page No.
	 * @param {String} req.pageSize - Page size limit.
	 * @param {String} req.searchText - Search text.
	 * @returns {JSON} - actions List.
	 */

	async list(req) {
		try {
			const actions = await actionService.list(req.pageNo, req.pageSize, req.searchText)
			return actions
		} catch (error) {
			return error
		}
	}

	/**
	 * deletes actions
	 * @method
	 * @name delete
	 * @param {Object} req - request data.
	 * @returns {JSON} - action deletion response.
	 */

	async delete(req) {
		try {
			const deletedAction = await actionService.delete(req.params.id)
			return deletedAction
		} catch (error) {
			return error
		}
	}
}

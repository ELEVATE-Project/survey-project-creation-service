/**
 * name : admin.js
 * author : Priyanka Pradeep
 * created-date : 14-Aug-2024
 * Description : Controller for Admin
 */

const adminService = require('@services/admin')
module.exports = class admin {
	/**
	 * Create data for new tenant .
	 * @method
	 * @name create
	 * @param {Integer} id  action id.
	 * @param {Object} body  action data
	 * @returns {JSON} - Detail of action as response.
	 */
	async create(req) {
		try {
			let action = await adminService.create(req.body)
			return action
		} catch (error) {
			return error
		}
	}
}

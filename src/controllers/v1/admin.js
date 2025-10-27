/**
 * name : admin.js
 * author : Priyanka Pradeep
 * created-date : 08-Sep-2025
 * Description : Controller for Admin
 */

const adminService = require('@services/admin')

module.exports = class admin {
	/**
	 * Handles a request to fetch data using a raw SELECT SQL query.
	 * which validates the query and returns results only for SELECT statements.
	 * @param {Object} req - The Express request object.
	 * @param {Object} req.body - The request body containing the query.
	 * @param {string} req.body.query - The raw SQL SELECT query string. {
		"query": "SELECT id, title from resources WHERE status='PUBLISHED'"
	}
	 * @param {number} req.pageNo - Page number for pagination.
	 * @param {number} req.pageSize - Page size for pagination.
	 * @returns {Promise<Object>} - The response returned by the admin service.
	 * @throws {Error} - Returns the error object if execution fails.
	 */
	async dbFind(req) {
		try {
			const data = await adminService.dbFind(req.body, req.pageNo, req.pageSize)
			return data
		} catch (error) {
			return error
		}
	}

	/**
	 * Create dependencies data for new tenant .
	 * @method
	 * @name createTenantDependencies
	 * @param {Object} req  req data
	 * @returns {Promise<Object>} -  JSON response indicating success or failure.
	 */
	async createTenantDependencies(req) {
		try {
			let tenantDependeciesData = await adminService.createTenantDependencies(
				req.body.tenant_code,
				req.body.organization_code,
				req.decodedToken.id
			)
			return tenantDependeciesData
		} catch (error) {
			return error
		}
	}
}

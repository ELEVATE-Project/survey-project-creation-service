const rolePermissionMappingQueries = require('@database/queries/role-permission-mapping')
const common = require('@constants/common')
const responses = require('@helpers/responses')

module.exports = class UserHelper {
	// Your other methods here

	/**
	 * Get permissions by user roles.
	 * @method
	 * @name getPermissions
	 * @param {Array} userRoles - Array of user roles.
	 * @returns {Array} - Array of mentor permissions.
	 */
	static async getPermissions(userRoles) {
		try {
			const titles = userRoles.map((role) => role.title)
			const filter = { role_title: titles }
			const attributes = ['module', 'request_type']
			const PermissionAndModules = await rolePermissionMappingQueries.findAll(filter, attributes)
			const PermissionByModules = PermissionAndModules.reduce((PermissionByModules, { module, request_type }) => {
				if (PermissionByModules[module]) {
					PermissionByModules[module].request_type = [
						...new Set([...PermissionByModules[module].request_type, ...request_type]),
					]
				} else {
					PermissionByModules[module] = { module, request_type: [...request_type] }
				}
				return PermissionByModules
			}, {})

			const allPermissions = Object.values(PermissionByModules).map(({ module, request_type }) => ({
				module,
				request_type,
				service: common.MENTORING_SERVICE,
			}))

			return allPermissions
		} catch (error) {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'PERMISSIONS_NOT_FOUND',
				result: { permissions: [] },
			})
		}
	}
}

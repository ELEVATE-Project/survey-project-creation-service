/**
 * name : validators/v1/role-permission-mapping.js
 * author : Priyanka Pradeep
 * Date : 10-Jun-2024
 * Description : Validations of role permission mapping controller
 */
const filterRequestBody = require('../common')
const { rolePermissionMapping } = require('@constants/blacklistConfig')

module.exports = {
	create: (req) => {
		req.body = filterRequestBody(req.body, rolePermissionMapping.create)
		req.checkBody('permission_id')
			.trim()
			.notEmpty()
			.withMessage('permission_id field is empty')
			.matches(/^[0-9]+$/)
			.withMessage('permission_id is invalid, must not contain spaces')

		req.checkBody('role_title')
			.trim()
			.notEmpty()
			.withMessage('role_title field is empty')
			.matches(/^[a-zA-Z_-]+$/)
			.withMessage('role_title is invalid, must not contain spaces')
	},

	delete: (req) => {
		req.body = filterRequestBody(req.body, rolePermissionMapping.delete)
		req.checkBody('permission_id')
			.trim()
			.notEmpty()
			.withMessage('permission_id field is empty')
			.matches(/^[0-9]+$/)
			.withMessage('permission_id is invalid, must not contain spaces')

		req.checkBody('role_title')
			.trim()
			.notEmpty()
			.withMessage('role_title field is empty')
			.matches(/^[a-zA-Z_-]+$/)
			.withMessage('role_title is invalid, must not contain spaces')
	},
}

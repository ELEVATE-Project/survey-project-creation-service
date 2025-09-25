/**
 * name : admin.js
 * author : Priyanka Pradeep
 * created-date : 08-Sep-2025
 * Description : Validations for admin controller
 */

module.exports = {
	dbFind: (req) => {
		req.checkBody('query')
			.trim()
			.notEmpty()
			.withMessage('Query is required')
			.isString()
			.withMessage('Query must be a string')
			.matches(/^\s*SELECT\b/i)
			.withMessage('Only SELECT queries are allowed')
	},
	createTenantDependencies: (req) => {
		req.checkBody('code').trim().notEmpty().withMessage('code field is empty')
		req.checkBody('org_code').trim().notEmpty().withMessage('org_code field is empty')
	},
}

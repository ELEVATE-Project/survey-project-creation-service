/**
 * name : validators/v1/resource.js
 * author : Adithya Dinesh
 * Date : 12-June-2024
 * Description : Validations of Resources controller
 */
const common = require('@constants/common')

module.exports = {
	list: (req) => {
		const page_status = Object.keys(common.PAGE_STATUS_VALUES)
		req.checkQuery(common.PAGE_STATUS)
			.notEmpty()
			.withMessage(common.PAGE_STATUS + ' param is empty')
			.isIn(page_status)
			.withMessage(common.PAGE_STATUS + ' value should be from : ' + page_status)
	},
}

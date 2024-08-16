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
		const listingPage = req.query[common.LISTING]
		req.checkQuery(common.LISTING)
			.notEmpty()
			.withMessage(common.LISTING + ' param is empty')
			.isIn(page_status)
			.withMessage(common.LISTING + ' value should be from : ' + page_status)
		req.checkQuery('status')
			.optional({ checkFalsy: true })
			.isIn(common.PAGE_STATUS_VALUES[listingPage])
			.withMessage('Status ' + req.query.status + ' invalid ')
	},
	publishCallback: (req) => {
		req.checkQuery('resource_id').trim().notEmpty().withMessage('resource_id field is empty')
		req.checkQuery('published_id').trim().notEmpty().withMessage('published_id field is empty')
	},
}

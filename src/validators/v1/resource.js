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
		const check_values =
			req.query[common.LISTING] === common.PAGE_STATUS_SUBMITTED_FOR_REVIEW
				? [...common.PAGE_STATUS_VALUES[req.query[common.LISTING]], common.REVIEW_STATUS_REQUESTED_FOR_CHANGES]
				: common.PAGE_STATUS_VALUES[req.query[common.LISTING]]
		req.checkQuery(common.LISTING)
			.notEmpty()
			.withMessage(common.LISTING + ' param is empty')
			.isIn(page_status)
			.withMessage(common.LISTING + ' value should be from : ' + page_status)
		req.checkQuery('status')
			.optional({ checkFalsy: true })
			.isIn(check_values)
			.withMessage('Status ' + req.query.status + ' invalid ')
	},
	publishCallback: (req) => {
		req.checkQuery('resource_id')
			.trim()
			.notEmpty()
			.withMessage('resource_id field is empty')
			.isNumeric()
			.withMessage('resource_id is invalid, must be an integer')
		req.checkQuery('published_id').trim().notEmpty().withMessage('published_id field is empty')
	},
	browseExisting: (req) => {
		// Validate type parameter if provided
		req.checkQuery(common.TYPE)
			.optional({ checkFalsy: true })
			.custom((value) => {
				// list of allowedTypes
				const resourceList = process.env.RESOURCE_TYPES.split(',')
				let resourceType = []
				if (req.query[common.TYPE] && req.query[common.TYPE] != '') {
					resourceType = req.query[common.TYPE].split(',')
					// Check if every element in resourceType is present in resourceList
					const isSubset = resourceType.every((type) => resourceList.includes(type))

					if (!isSubset) {
						throw new Error('Invalid type(s) provided in query parameter.')
					}
				}
				return true
			})
	},
}

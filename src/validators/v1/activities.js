/**
 * name : validators/v1/activities.js
 * author : Priyanka Pradeep
 * Date : 29-Aug-2024
 * Description : Validations of activities controller
 */

module.exports = {
	list: (req) => {
		req.checkParams('id')
			.trim()
			.notEmpty()
			.withMessage('id param is empty')
			.isNumeric()
			.withMessage('id param is invalid, must be an integer')
	},
}

/**
 * name : validators/v1/targeting.js
 * author : Adithya Dinesh
 * Date : 04-Nov-2025
 * Description : Validations of targeting controller
 */
module.exports = {
	subEntityList: (req) => {
		req.checkQuery('subEntityType').notEmpty().withMessage('subEntityType cannot be empty ')

		req.checkBody('parentEntities', 'parentEntities must be an array').custom((value) => {
			if (!Array.isArray(value)) {
				throw new Error('parentEntities must an array')
			}
			if (Array.isArray(value) && value.length === 0) {
				throw new Error('parentEntities must not be empty')
			}
			return true
		})
	},

	hierarchy: (req) => {
		req.checkParams('id').trim().notEmpty().withMessage('id param is empty')
	},
}

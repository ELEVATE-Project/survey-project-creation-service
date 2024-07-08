module.exports = {
	createConfig: (req) => {
		req.checkBody('resource_type').trim().notEmpty().withMessage('resource_type field is empty')
	},
	updateConfig: (req) => {
		req.checkParams('id').notEmpty().withMessage('id param is empty')
		req.checkQuery('resource_type').trim().notEmpty().withMessage('resource_type field is empty')
	},
}

module.exports = {
	update: (req) => {
		req.checkBody('code').trim().notEmpty().withMessage('code field is empty')

		req.checkBody('name').trim().notEmpty().withMessage('name field is empty')

		req.checkBody('url').trim().notEmpty().withMessage('url field is empty')

		req.checkBody('resource_type').trim().notEmpty().withMessage('resource_type field is empty')

		req.checkBody('meta')
			.trim()
			.notEmpty()
			.withMessage('meta field is empty, Please add the logo and signature information')
	},
}

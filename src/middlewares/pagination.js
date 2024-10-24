/**
 * name : pagination.js
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : Pagination
 */
const httpStatus = require('@generics/http-status')
const responses = require('@helpers/responses')
const unidecode = require('unidecode')
function containsSpecialChars(str) {
	str = unidecode(str)
	const specialChars = /[`!#$%^*()+\=\[\]{};':"\\|\/?~]/
	return specialChars.test(str)
}

module.exports = (req, res, next) => {
	req.pageNo = req.query.page && Number(req.query.page) > 0 ? Number(req.query.page) : 1
	req.pageSize =
		req.query.limit && Number(req.query.limit) > 0 && Number(req.query.limit) <= 100 ? Number(req.query.limit) : 100
	req.searchText = req.query.search && req.query.search != '' ? req.query.search : ''

	if (containsSpecialChars(req.searchText)) {
		throw responses.failureResponse({
			message: 'Invalid search text',
			statusCode: httpStatus.bad_request,
			responseCode: 'CLIENT_ERROR',
		})
	} else {
		delete req.query.page
		delete req.query.limit
		next()
	}
}

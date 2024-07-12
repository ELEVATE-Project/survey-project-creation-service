'use strict'
const ReviewResource = require('../models/index').ReviewResource

exports.findAll = async (filter, attributes = {}) => {
	try {
		const res = await ReviewResource.findAll({
			where: filter,
			attributes,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}
exports.countDistinct = async (filter, attributes = {}) => {
	try {
		const res = await ReviewResource.count({
			where: filter,
			distinct: true,
		})

		return res
	} catch (error) {
		return error
	}
}

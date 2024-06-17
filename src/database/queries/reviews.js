'use strict'
const reviews = require('../models/index').Review

exports.findAll = async (filter, attributes = {}) => {
	try {
		const res = await reviews.findAll({
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
		const res = await reviews.count({
			where: filter,
			distinct: true,
		})

		return res
	} catch (error) {
		return error
	}
}

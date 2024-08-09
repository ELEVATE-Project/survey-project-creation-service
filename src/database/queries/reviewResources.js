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

exports.findOne = async (filter, options = {}) => {
	try {
		return await ReviewResource.findOne({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		throw error
	}
}

exports.create = async (data) => {
	try {
		return await ReviewResource.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

'use strict'
const { ReviewResource, Resource } = require('../models/index')

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

exports.bulkCreate = async (data) => {
	try {
		const res = await ReviewResource.bulkCreate(data)

		return res
	} catch (error) {
		return error
	}
}

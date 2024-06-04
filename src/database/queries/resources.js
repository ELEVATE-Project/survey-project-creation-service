'use strict'
const Resource = require('../models/index').Resource

exports.create = async (data) => {
	try {
		return await Resource.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.findOne = async (filter, options = {}) => {
	try {
		return await Resource.findOne({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		return error
	}
}

exports.updateOne = async (filter, update, options = {}) => {
	try {
		const [res] = await Resource.update(
			update,
			{
				where: filter,
				...options,
				individualHooks: true,
			},
			{ returning: true }
		)

		return res
	} catch (error) {
		return error
	}
}

exports.findAll = async (filter, attributes = {}, sort, page, limit) => {
	try {
		const res = await Resource.findAll({
			where: filter,
			attributes,
			order: [[sort.sort_by, sort.order]],
			offset: limit * (page - 1),
			limit: limit,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}

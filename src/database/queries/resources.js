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

exports.findAll = async (filter, attributes = {}) => {
	try {
		const res = await Resource.findAll({
			where: filter,
			attributes,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}

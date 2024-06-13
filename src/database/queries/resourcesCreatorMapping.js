'use strict'
const resource_user_mapping = require('../models/index').ResourceCreatorMapping

exports.create = async (data) => {
	try {
		return await resource_user_mapping.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.findAll = async (filter, attributes = {}) => {
	try {
		const res = await resource_user_mapping.findAll({
			where: filter,
			attributes,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}

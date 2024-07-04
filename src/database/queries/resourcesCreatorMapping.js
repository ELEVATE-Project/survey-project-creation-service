'use strict'
const ResourceCreatorMapping = require('../models/index').ResourceCreatorMapping

exports.create = async (data) => {
	try {
		return await ResourceCreatorMapping.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.findAll = async (filter, attributes = {}, options = {}) => {
	try {
		const res = await ResourceCreatorMapping.findAll({
			where: filter,
			attributes,
			raw: true,
			...options,
		})

		return res
	} catch (error) {
		return error
	}
}
exports.findOne = async (filter, attributes = {}, options = {}) => {
	try {
		const res = await ResourceCreatorMapping.findOne({
			where: filter,
			attributes,
			raw: true,
			...options,
		})

		return res
	} catch (error) {
		return error
	}
}

exports.updateOne = async (filter, update, options = {}) => {
	try {
		const [res] = await ResourceCreatorMapping.update(
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

exports.deleteOne = async (id, creator_id) => {
	try {
		return await ResourceCreatorMapping.destroy({
			where: {
				id,
				creator_id,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

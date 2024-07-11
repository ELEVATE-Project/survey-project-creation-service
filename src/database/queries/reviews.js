'use strict'
const Review = require('../models/index').Review

exports.findAll = async (filter, attributes = {}) => {
	try {
		const res = await Review.findAll({
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
		const res = await Review.count({
			where: filter,
			distinct: true,
		})

		return res
	} catch (error) {
		return error
	}
}

exports.bulkCreate = async (data) => {
	try {
		const res = await Review.bulkCreate(data)
		return res
	} catch (error) {
		return error
	}
}

exports.findOne = async (filter, options = {}) => {
	try {
		return await Review.findOne({
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
		return await Review.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.updateOne = async (filter, update, options = {}) => {
	try {
		const [res] = await Review.update(
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

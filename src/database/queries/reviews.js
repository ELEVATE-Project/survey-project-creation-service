'use strict'
const Review = require('../models/index').Review
const { fn, col } = require('sequelize')

exports.findAll = async (filter, attributes = {}, options = {}) => {
	try {
		const res = await Review.findAll({
			where: filter,
			attributes,
			...options,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}

exports.distinctResources = async (filter, attributes) => {
	try {
		const res = await Review.findAll({
			where: filter,
			attributes: [[fn('COUNT', fn('DISTINCT', col('status'))), 'distinctCount'], ...attributes],
			group: ['resource_id'],
			raw: true,
		})

		return {
			count: res.length,
			resource_ids: res.map((row) => row.resource_id),
		}
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

exports.update = async (filter, update, options = {}) => {
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

exports.count = async (filter) => {
	try {
		const count = await Review.count({
			where: filter,
		})

		return count
	} catch (error) {
		return error
	}
}

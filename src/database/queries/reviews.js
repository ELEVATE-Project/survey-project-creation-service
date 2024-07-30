'use strict'
const reviews = require('../models/index').Review
const { fn, col } = require('sequelize')

exports.findAll = async (filter, attributes = {}, options = {}) => {
	try {
		const res = await reviews.findAll({
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
		const res = await reviews.findAll({
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
		const res = await reviews.bulkCreate(data)

		return res
	} catch (error) {
		return error
	}
}

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

exports.countDistinct = async (filter, attributes = ['resource_id']) => {
	try {
		const res = await reviews.findAndCountAll({
			where: filter,
			attributes: attributes, // Select the specified attributes, defaulting to 'resource_id'
			distinct: true, // Ensure distinct results
		})

		// Extract unique resource IDs
		const uniqueResourceIds = res.rows.map((row) => row.resource_id)

		return {
			count: res.count,
			resource_ids: uniqueResourceIds,
		}
	} catch (error) {
		console.error('Error in countDistinct:', error)
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

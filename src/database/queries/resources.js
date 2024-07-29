'use strict'

const common = require('@constants/common')
const { Sequelize } = require('sequelize')
const Resource = require('../models/index').Resource
const { ValidationError } = require('sequelize')

exports.create = async (data) => {
	try {
		return await Resource.create(data, { returning: true })
	} catch (error) {
		if (error instanceof ValidationError) {
			const messages = error.errors.map((err) => `${err.path} cannot be null.`)
			throw new Error(messages.join(' '))
		} else {
			throw new Error(error.message)
		}
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
		const res = await Resource.update(update, {
			where: filter,
			...options,
			individualHooks: true,
		})

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
exports.resourceList = async (
	filter,
	attributes = {},
	sort = { sort_by: common.CREATED_AT, order: common.SORT_DESC },
	page = null,
	limit = null
) => {
	try {
		const order =
			sort.sort_by === common.RESOURCE_TITLE
				? [[Sequelize.fn('LOWER', Sequelize.col(sort.sort_by)), sort.order]]
				: [[sort.sort_by, sort.order]]

		let resourceFilter = {
			where: filter,
			attributes,
			order,
			raw: true,
		}
		if (limit) resourceFilter.limit = limit
		if (page) resourceFilter.offset = limit * (page - 1)

		const res = await Resource.findAndCountAll(resourceFilter)

		return { result: res.rows, count: res.count }
	} catch (error) {
		return error
	}
}

exports.deleteOne = async (id, organization_id) => {
	try {
		return await Resource.destroy({
			where: {
				id,
				organization_id,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

'use strict'

const common = require('@constants/common')
const { Sequelize } = require('sequelize')
const Comment = require('../models/index').Comment
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
			throw new Error(error)
		}
	}
}

exports.findOne = async (filter, options = {}) => {
	try {
		let raw = options?.raw || true
		if (options.commentsAttributes && options.commentsAttributes.length > 0) {
			let include = {
				model: Comment,
				as: 'comments',
				required: false,
			}
			// if commentsAttributes is not empty, add attributes to include * retrun all columns else ,
			// return only the specified attributes
			if (
				!options.commentsAttributes.some((attr) => attr === common.PROJECTION_KEY_ASTRICKTS) &&
				options.commentsAttributes.length != 0
			)
				include.attributes = options.commentsAttributes
			// if commentsFilter is provided, add it to the where clause
			if (options.commentsFilter && Object.keys(options.commentsFilter).length > 0)
				include.where = options.commentsFilter

			options.include = [include]
			raw = false
		}
		const resource = await Resource.findOne({
			where: filter,
			...options,
			raw,
		})
		if (raw) return resource
		return resource ? resource.toJSON() : {}
	} catch (error) {
		throw error
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
		throw error
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
exports.resourceList = async (filter, attributes = {}, sort, page = 1, limit = common.LIMIT) => {
	try {
		let order =
			sort.sort_by === common.RESOURCE_TITLE
				? [[Sequelize.fn('LOWER', Sequelize.col(sort.sort_by)), sort.order]]
				: !sort.sort_by || !sort.order
				? [common.CREATED_AT, common.SORT_DESC]
				: [[sort.sort_by, sort.order]]

		let resourceFilter = {
			where: filter,
			attributes,
			raw: true,
		}
		if (limit) resourceFilter.limit = limit
		if (page) resourceFilter.offset = limit * (page - 1)
		if (sort) resourceFilter.order = [order]

		const res = await Resource.findAndCountAll(resourceFilter)

		return { result: res.rows, count: res.count }
	} catch (error) {
		return error
	}
}
exports.count = async (filter) => {
	try {
		const result = await Resource.count({ where: filter })
		return result
	} catch (error) {
		return error
	}
}

exports.deleteOne = async (id, organization_code, tenantCode) => {
	try {
		return await Resource.destroy({
			where: {
				id,
				organization_code,
				tenant_code: tenantCode,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

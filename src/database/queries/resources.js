'use strict'

const common = require('@constants/common')
const database = require('@database/models/index')
const { Sequelize } = require('sequelize')
const Comment = require('../models/index').Comment
const Resource = require('../models/index').Resource
const { ValidationError } = require('sequelize')
const { Op } = require('sequelize')

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

exports.resourceList = async (
	filter,
	attributes = {},
	sort = {},
	page = 1,
	limit = common.LIMIT,
	returnReview = false
) => {
	try {
		let resourceFilter = {
			where: filter,
			attributes,
			raw: true,
		}
		let include = []
		if (returnReview) {
			include.push({
				model: database.Review,
				as: 'reviews',
				where: {
					tenant_code: filter.tenant_code,
				},
				required: false,
			})
			resourceFilter.include = include
			resourceFilter.raw = true
			resourceFilter.nest = true
		}

		// Handle ordering with explicit table alias
		if (sort && sort.sort_by === common.RESOURCE_TITLE) {
			const direction = sort.order || 'ASC'
			// Use explicit table reference for LOWER function
			resourceFilter.order = [
				Sequelize.literal(`LOWER("${common.MODEL_NAMES.RESOURCE}"."${common.RESOURCE_TITLE}") ${direction}`),
			]
		} else if (sort && sort.sort_by && sort.order) {
			// Convert to Sequelize.literal for consistency
			const validOrder = ['ASC', 'DESC'].includes(sort.order[0].toUpperCase())
				? sort.order[0].toUpperCase()
				: 'ASC'
			resourceFilter.order = [Sequelize.literal(`"${sort.sort_by}" ${validOrder}`)]
		} else {
			resourceFilter.order = [Sequelize.literal(`"created_at" ${common.SORT_DESC}`)]
		}
		// Handle pagination
		if (limit) {
			resourceFilter.limit = limit
		}
		if (page && page > 0) {
			resourceFilter.offset = limit * (page - 1)
		}

		let res = await Resource.findAndCountAll(resourceFilter)

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

exports.findAllWithOpenComments = async (filter, attributes = {}) => {
	try {
		if (!filter?.tenant_code || !filter?.id) {
			throw new Error('filter.tenant_code and filter.id are required')
		}
		const res = await Resource.findAll({
			where: filter,
			attributes,
			include: [
				{
					model: Comment,
					as: 'comments',
					required: false,
					where: {
						status: common.COMMENT_STATUS_OPEN,
						tenant_code: filter.tenant_code,
						resource_id: filter.id,
					},
				},
			],
			raw: false,
		})

		return res
	} catch (error) {
		return error
	}
}

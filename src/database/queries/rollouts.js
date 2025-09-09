'use strict'
const Rollout = require('../models/index').Rollout
const { ValidationError } = require('sequelize')
const Resource = require('../models/index').Resource

exports.create = async (data) => {
	try {
		return await Rollout.create(data, { returning: true })
	} catch (error) {
		if (error instanceof ValidationError) {
			const messages = error.errors.map((err) => `${err.path} cannot be null.`)
			throw new Error(messages.join(' '))
		} else {
			throw new Error(error)
		}
	}
}

exports.findOne = async (filter, options = {}, addResourceConstraints = false) => {
	try {
		// Add resourceDetails to options.include if flag is true
		if (addResourceConstraints) {
			options.include = [
				...(options.include || []),
				{
					model: Resource,
					as: 'resourceDetails',
					required: true,
				},
			]
		}

		return await Rollout.findOne({
			where: filter,
			...options,
			raw: true,
			nest: true,
		})
	} catch (error) {
		return error
	}
}

exports.updateOne = async (filter, update, options = {}) => {
	try {
		const res = await Rollout.update(update, {
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
		const res = await Rollout.findAll({
			where: filter,
			attributes,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}
exports.findAllAndCount = async (filter, attributes = [], options = {}) => {
	try {
		const rolloutFilter = {
			where: filter,
			attributes,
			...options,
			raw: true,
		}
		const res = await Rollout.findAndCountAll(rolloutFilter)

		return { result: res.rows, count: res.count }
	} catch (error) {
		return error
	}
}

exports.deleteOne = async (id, organization_code, tenant_code) => {
	try {
		return await Rollout.destroy({
			where: {
				id,
				organization_code,
				tenant_code,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

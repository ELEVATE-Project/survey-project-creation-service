'use strict'
const ProgramResourceMapping = require('../models/index').ProgramResourceMapping
const { Op } = require('sequelize')

exports.create = async (data) => {
	try {
		return await ProgramResourceMapping.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.findAll = async (filter, attributes = {}, options = {}) => {
	try {
		const res = await ProgramResourceMapping.findAll({
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
		const res = await ProgramResourceMapping.findOne({
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
		const [res] = await ProgramResourceMapping.update(
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

exports.deleteMany = async (programId, resourceIds, tenantCode) => {
	try {
		if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
			throw new Error('Invalid or empty IDs array')
		}

		const res = await ProgramResourceMapping.destroy({
			where: {
				program_id: programId,
				tenant_code: tenantCode,
				resource_id: { [Op.in]: resourceIds },
			},
			individualHooks: true,
		})

		return res
	} catch (error) {
		throw error
	}
}

'use strict'
const ProgramResourceMapping = require('../models/index').ProgramResourceMapping

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

exports.deleteOne = async (id, program_id) => {
	try {
		return await ProgramResourceMapping.destroy({
			where: {
				id,
				program_id,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

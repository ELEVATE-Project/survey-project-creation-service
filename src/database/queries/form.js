'use strict'
const Form = require('../models/index').Form

exports.create = async (data) => {
	try {
		return await Form.create(data)
	} catch (error) {
		throw error
	}
}

exports.findOne = async (filter, options = {}) => {
	try {
		return await Form.findOne({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		return error
	}
}

exports.findAll = async (filter, options = {}) => {
	try {
		return await Form.findAll({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		return error
	}
}

exports.updateOneForm = async (filter, update, options = {}) => {
	try {
		const [res] = await Form.update(update, {
			where: filter,
			...options,
			individualHooks: true,
		})

		return res
	} catch (error) {
		return error
	}
}

exports.findAllTypeFormVersion = async (orgCode, tenantCode) => {
	try {
		const formData = await Form.findAll({
			where: {
				organization_code: orgCode,
				tenant_code: tenantCode,
			},
			attributes: ['id', 'type', 'version'],
			raw: true,
		})
		return formData
	} catch (error) {
		return error
	}
}

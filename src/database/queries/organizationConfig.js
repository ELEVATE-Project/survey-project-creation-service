const organizationConfig = require('../models/index').organizationConfig

exports.findOne = async (filter, attributes = []) => {
	try {
		return await organizationConfig.findOne({
			where: filter,
			attributes,
			raw: true,
		})
	} catch (error) {
		return error
	}
}
exports.findAll = async (filter, attributes = []) => {
	try {
		return await organizationConfig.findAll({
			where: filter,
			attributes,
			raw: true,
		})
	} catch (error) {
		return error
	}
}

exports.create = async (data) => {
	try {
		return await organizationConfig.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.update = async (filter, update, options = {}) => {
	try {
		return await organizationConfig.update(update, {
			where: filter,
			...options,
		})
	} catch (error) {
		return error
	}
}

exports.upsert = async (values, filter, options = {}) => {
	try {
		return await organizationConfig.upsert(values, {
			...options,
			where: filter,
		})
	} catch (error) {
		return error
	}
}

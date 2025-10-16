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
exports.findAll = async (filter, attributes = null) => {
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

exports.findMany = async (filter, attributes) => {
	try {
		const queryOptions = {
			where: filter,
			raw: true,
		}

		if (attributes && attributes.length > 0) {
			queryOptions.attributes = attributes
		}

		return await organizationConfig.findAll(queryOptions)
	} catch (error) {
		return error
	}
}

exports.bulkCreate = async (data, options = {}) => {
	try {
		return await organizationConfig.bulkCreate(data, options)
	} catch (error) {
		return error
	}
}

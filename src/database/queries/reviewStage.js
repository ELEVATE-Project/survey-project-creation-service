const ReviewStage = require('../models/index').ReviewStage
const { UniqueConstraintError, ValidationError } = require('sequelize')

exports.bulkCreate = async (data) => {
	try {
		const res = await ReviewStage.bulkCreate(data)
		return res
	} catch (error) {
		if (error instanceof UniqueConstraintError) {
			throw new Error('Review stages for role and level already exist')
		} else if (error instanceof ValidationError) {
			const messages = error.errors.map((err) => `${err.path} cannot be null.`)
			throw new Error(messages.join(' '))
		} else {
			throw new Error(error.message)
		}
	}
}

exports.findAll = async (filter, options = {}) => {
	try {
		const res = await ReviewStage.findAll({
			where: filter,
			...options,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}

exports.findOne = async (filter, options = {}) => {
	try {
		const res = await ReviewStage.findOne({
			where: filter,
			...options,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}

exports.create = async (data) => {
	try {
		return await ReviewStage.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.findAllReviewStages = async (filter, attributes, options = {}) => {
	try {
		return await ReviewStage.findAndCountAll({
			where: filter,
			attributes,
			...options,
		})
	} catch (error) {
		return error
	}
}

exports.updateOne = async (filter, update, options = {}) => {
	try {
		const res = await ReviewStage.update(update, {
			where: filter,
			...options,
			individualHooks: true,
		})
		return res
	} catch (error) {
		return error
	}
}

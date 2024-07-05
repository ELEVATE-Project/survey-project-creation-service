const ReviewStage = require('../models/index').ReviewStage

exports.bulkCreate = async (data) => {
	try {
		const res = await ReviewStage.bulkCreate(data)
		return res
	} catch (error) {
		return error
	}
}

exports.findAll = async (filter, attributes = {}) => {
	try {
		const res = await ReviewStage.findAll({
			where: filter,
			attributes,
			raw: true,
		})

		return res
	} catch (error) {
		return error
	}
}

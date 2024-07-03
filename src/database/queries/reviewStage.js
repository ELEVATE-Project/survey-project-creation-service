const ReviewStage = require('../models/index').ReviewStage

exports.bulkCreate = async (data) => {
	try {
		const res = await ReviewStage.bulkCreate(data)
		return res
	} catch (error) {
		return error
	}
}

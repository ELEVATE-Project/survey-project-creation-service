const CertificateBaseTemplate = require('../models/index').CertificateBaseTemplate

module.exports = class certificateData {
	static async findAll(filter, options = {}) {
		try {
			return await CertificateBaseTemplate.findAll({
				where: filter,
				...options,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async create(data) {
		try {
			return await CertificateBaseTemplate.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async updateOne(filter, update, options = {}) {
		try {
			const res = await CertificateBaseTemplate.update(
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
			throw error
		}
	}

	static async findOne(filter) {
		try {
			return await CertificateBaseTemplate.findOne({
				where: filter,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}
}

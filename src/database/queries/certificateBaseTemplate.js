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
}

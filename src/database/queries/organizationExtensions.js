const OrgExtensions = require('../models/index').organizationExtension

exports.create = async (data) => {
	try {
		return await OrgExtensions.create(data, { returning: true })
	} catch (error) {
		return error
	}
}

exports.update = async (filter, update, options = {}) => {
	try {
		return await OrgExtensions.update(update, {
			where: filter,
			...options,
		})
	} catch (error) {
		return error
	}
}

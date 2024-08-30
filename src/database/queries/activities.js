const Activity = require('@database/models/index').Activity

module.exports = class ActivityData {
	static async create(data) {
		try {
			return await Activity.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findAllActivities(filter, attributes, options = {}) {
		try {
			const { rows, count } = await Activity.findAndCountAll({
				where: filter,
				attributes,
				...options,
				raw: true,
			})
			return { rows, count }
		} catch (error) {
			throw error
		}
	}
}

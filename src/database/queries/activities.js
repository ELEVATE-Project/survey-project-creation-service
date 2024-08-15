const Activity = require('@database/models/index').Activity

module.exports = class ActivityData {
	static async create(data) {
		try {
			return await Activity.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}
}

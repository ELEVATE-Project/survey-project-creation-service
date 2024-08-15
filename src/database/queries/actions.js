const Action = require('@database/models/index').Action

module.exports = class ActionData {
	static async create(data) {
		try {
			return await Action.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findOne(filter, attributes) {
		try {
			return await Action.findOne({
				where: filter,
				attributes,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async updateOne(filter, update, options = {}) {
		try {
			const res = await Action.update(update, {
				where: filter,
				...options,
				individualHooks: true,
			})
			return res
		} catch (error) {
			throw error
		}
	}
}

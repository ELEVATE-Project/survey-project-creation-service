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

	static async findAllActions(filter, attributes, options = {}) {
		try {
			const { rows, count } = await Action.findAndCountAll({
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

	static async deleteAction(id) {
		try {
			const deletedRows = await Action.destroy({
				where: { id: id },
				individualHooks: true,
			})
			return deletedRows
		} catch (error) {
			throw error
		}
	}

	static async findById(id) {
		try {
			return await Action.findByPk(id)
		} catch (error) {
			throw error
		}
	}

	static async findAll(filter, attributes, options = {}) {
		try {
			const actions = await Action.findAll({
				where: filter,
				attributes,
				...options,
				raw: true,
			})
			return actions
		} catch (error) {
			throw error
		}
	}
}

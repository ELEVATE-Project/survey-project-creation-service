const Comment = require('@database/models/index').Comment

module.exports = class CommentData {
	static async create(data) {
		try {
			return await Comment.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findById(id) {
		try {
			return await Comment.findByPk(id)
		} catch (error) {
			throw error
		}
	}

	static async findAll(filter, attributes, options = {}) {
		try {
			const { rows, count } = await Comment.findAndCountAll({
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

	static async updateOne(filter, update, options = {}) {
		try {
			return await Comment.update(update, {
				where: filter,
				...options,
			})
		} catch (error) {
			throw error
		}
	}

	static async findOne(filter) {
		try {
			const comments = await Comment.findOne({
				where: filter,
				raw: true,
			})
			return comments
		} catch (error) {
			throw error
		}
	}
}

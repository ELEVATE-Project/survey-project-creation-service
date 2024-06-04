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
			const comments = await Comment.findAndCountAll({
				where: filter,
				attributes,
				...options,
			})
			return comments
		} catch (error) {
			throw error
		}
	}

	static async update(filter, updateData) {
		try {
			const [rowsUpdated, [updatedComment]] = await Comment.update(updateData, {
				where: filter,
				returning: true,
			})
			return updatedComment
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

const Comment = require('@database/models/index').Comment
const { Op } = require('sequelize')
const common = require('@constants/common')

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
			const res = await Comment.findAll({
				where: filter,
				attributes,
				...options,
				raw: true,
			})

			return res
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

	static async commentList(resourceId, loggedInUserId, page_value, context) {
		try {
			let filterQuery = {
				resource_id: resourceId,
				[Op.or]: [
					{ status: { [Op.ne]: common.COMMENT_STATUS_DRAFT } },
					{ status: common.COMMENT_STATUS_DRAFT, user_id: loggedInUserId },
				],
			}

			if (page_value) {
				filterQuery.page = page_value
			}

			if (context) {
				filterQuery.context = context
			}

			const { rows, count } = await Comment.findAndCountAll({
				where: filterQuery,
				order: [[common.CREATED_AT, common.SORT_DESC]],
			})

			return { rows, count }
		} catch (error) {
			throw error
		}
	}
}

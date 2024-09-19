const Comment = require('@database/models/index').Comment
const { Op, Sequelize } = require('sequelize')
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
	/**
	 * comment delete
	 * @method
	 * @name delete
	 * @param {Integer} id - comment id
	 * @param {Integer} resourceId - resource id
	 * @param {String} userId - user id
	 * @returns {JSON} - comment delete response.
	 */
	static async deleteOne(id, resourceId, userId) {
		try {
			const filter = {
				where: {
					id,
					resource_id: resourceId,
					user_id: userId,
					status: common.COMMENT_STATUS_DRAFT,
				},
			}

			let deleteComment = await Comment.destroy(filter)

			if (deleteComment === 0) {
				throw new Error('COMMENT_NOT_FOUND')
			}

			return deleteComment
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

	static async list(resourceId, userId, page_value, context) {
		try {
			let filterQuery = {
				resource_id: resourceId,
				[Op.or]: [
					{ status: { [Op.ne]: common.COMMENT_STATUS_DRAFT } },
					{ status: common.COMMENT_STATUS_DRAFT, user_id: userId },
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
				attributes: {
					exclude: ['comment'],
					include: [
						[Sequelize.col('comment'), 'text'], // Alias 'comment' to 'text'
					],
				},
				order: [[common.CREATED_AT, common.SORT_ASC]],
				raw: true,
			})

			return { rows, count }
		} catch (error) {
			throw error
		}
	}

	static async findAndCountAll(filter, attributes, options = {}) {
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

	static async bulkCreate(data) {
		try {
			return await Comment.bulkCreate(data)
		} catch (error) {
			throw error
		}
	}
}

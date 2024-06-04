const Module = require('@database/models/index').Module

module.exports = class UserRoleModulesData {
	static async createModules(data) {
		try {
			return await Module.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findModulesById(id) {
		try {
			return await Module.findByPk(id)
		} catch (error) {
			throw error
		}
	}

	static async findAllModules(filter, attributes, options) {
		try {
			const permissions = await Module.findAndCountAll({
				where: filter,
				attributes,
				options,
			})
			return permissions
		} catch (error) {
			throw error
		}
	}

	static async updateModules(filter, data) {
		try {
			const [rowsUpdated, [updatedModules]] = await Module.update(data, {
				where: filter,
				returning: true,
				raw: true,
			})
			return updatedModules
		} catch (error) {
			throw error
		}
	}

	static async deleteModulesById(id) {
		try {
			const deletedRows = await Module.destroy({
				where: { id: id },
				individualHooks: true,
			})
			return deletedRows
		} catch (error) {
			throw error
		}
	}
}

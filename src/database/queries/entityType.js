const EntityType = require('../models/index').EntityType
const Entity = require('../models/index').Entity
const { Op } = require('sequelize')
const common = require('@constants/common')
const utils = require('@generics/utils')

module.exports = class UserEntityData {
	static async createEntityType(data) {
		try {
			return await EntityType.create(data, { returning: true })
		} catch (error) {
			throw error
		}
	}

	static async findOneEntityType(filter, options = {}) {
		try {
			return await EntityType.findOne({
				where: filter,
				...options,
				raw: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async findAllEntityTypes(orgCodes, tenantCode, attributes, filter = {}) {
		try {
			const entityData = await EntityType.findAll({
				where: {
					organization_code: { [Op.in]: orgCodes },
					tenant_code: tenantCode,
					status: common.STATUS_ACTIVE,
					...filter,
				},
				attributes,
				raw: true,
			})
			return entityData
		} catch (error) {
			return error
		}
	}
	static async findUserEntityTypeAndEntities(filter) {
		try {
			const entityTypes = await EntityType.findAll({
				where: filter,
				include: [
					{
						model: Entity,
						as: 'entities',
						where: { status: filter.status, tenant_code: filter.tenant_code }, // Ensure tenant isolation and citus compatibility
						required: false, // LEFT JOIN to include entity types with no entities
					},
				],
			})

			const result = entityTypes.map((entityType) => {
				const plainEntityType = entityType.get({ plain: true })
				return {
					...plainEntityType,
					entities: plainEntityType.entities || [], // alias is 'entities'
				}
			})

			return result
		} catch (error) {
			console.error('Error fetching entity types and entities:', error)
			throw new Error(`Failed to fetch data: ${error.message}`)
		}
	}
	static async findOneEntityTypeAndEntities(filter) {
		try {
			let entityType = await EntityType.findOne({
				where: filter,
				raw: true,
			})

			if (!entityType) {
				filter.organization_code = utils.convertToString(process.env.DEFAULT_ORGANISATION_CODE)
				entityType = await EntityType.findOne({
					where: filter,
					raw: true,
				})
			}

			const entities = await Entity.findAll({
				where: { entity_type_id: entityType.id, status: common.STATUS_ACTIVE },
				raw: true,
			})

			const result = {
				...entityType,
				entities: [...entities],
			}

			return result
		} catch (error) {
			console.error('Error fetching data:', error)
			throw error
		}
	}

	static async updateOneEntityType(id, orgCode, tenantCode, update, options = {}) {
		try {
			return await EntityType.update(update, {
				where: {
					id: id,
					organization_code: orgCode,
					tenant_code: tenantCode,
				},
				...options,
			})
		} catch (error) {
			throw error
		}
	}

	static async deleteOneEntityType(id, organizationId) {
		try {
			return await EntityType.destroy({
				where: {
					id: id,
					organization_code: organizationId,
				},
				individualHooks: true,
			})
		} catch (error) {
			throw error
		}
	}

	static async findEntityTypeById(filter) {
		try {
			return await EntityType.findByPk(filter)
		} catch (error) {
			return error
		}
	}

	static async findAllEntityTypesAndEntities(filter) {
		try {
			const entityTypes = await EntityType.findAll({
				where: filter,
				raw: true,
			})

			const entityTypeIds = entityTypes.map((entityType) => entityType.id)

			// Fetch all matching entities using the IDs
			const entities = await Entity.findAll({
				where: { entity_type_id: entityTypeIds, status: common.STATUS_ACTIVE },
				raw: true,
				//attributes: { exclude: ['entity_type_id'] },
			})

			const result = entityTypes.map((entityType) => {
				const matchingEntities = entities.filter((entity) => entity.entity_type_id === entityType.id)
				return {
					...entityType,
					entities: matchingEntities,
				}
			})
			return result
		} catch (error) {
			return error
		}
	}
}

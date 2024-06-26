const EntityType = require('../models/index').EntityType
const Entity = require('../models/index').Entity
const { Op } = require('sequelize')
const common = require('@constants/common')

exports.createEntityType = async (data) => {
	try {
		return await EntityType.create(data)
	} catch (error) {
		throw error
	}
}

exports.findOneEntityType = async (filter, options = {}) => {
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

exports.findAllEntityTypes = async (orgIds, attributes, filter = {}) => {
	try {
		const entityData = await EntityType.findAll({
			where: {
				organization_id: orgIds,
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

exports.findUserEntityTypeAndEntities = async (filter) => {
	try {
		const entityTypes = await EntityType.findAll({
			where: filter,
			raw: true,
		})

		const entityTypeIds = entityTypes.map((entityType) => entityType.id)

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
		console.error('Error fetching data:', error)
		throw error
	}
}

exports.findOneEntityTypeAndEntities = async (filter) => {
	try {
		let entityType = await EntityType.findOne({
			where: filter,
			raw: true,
		})

		if (!entityType) {
			filter.organization_id = process.env.DEFAULT_ORG_ID
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

exports.updateOneEntityType = async (id, orgId, update, options = {}) => {
	try {
		return await EntityType.update(update, {
			where: {
				id: id,
				organization_id: orgId,
			},
			...options,
		})
	} catch (error) {
		throw error
	}
}

exports.deleteOneEntityType = async (id, organizationId) => {
	try {
		return await EntityType.destroy({
			where: {
				id: id,
				organization_id: organizationId,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

exports.findEntityTypeById = async (filter) => {
	try {
		return await EntityType.findByPk(filter)
	} catch (error) {
		return error
	}
}
exports.findAllEntityTypesAndEntities = async (filter) => {
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

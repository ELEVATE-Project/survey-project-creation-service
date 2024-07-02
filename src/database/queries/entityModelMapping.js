'use strict'

const EntityModelMapping = require('../models/index').EntityModelMapping
const EntityType = require('../models/index').EntityType
const common = require('@constants/common')
exports.create = async (data) => {
	try {
		return await EntityModelMapping.create(data)
	} catch (error) {
		throw error
	}
}

exports.findEntityTypes = async (filter, attributes = {}) => {
	try {
		const entityModelMappingData = await EntityModelMapping.findAll({
			where: filter,
			raw: true,
		})

		const entityTypeIds = entityModelMappingData.map((entityModelMapping) => entityModelMapping.entity_type_id)

		const EntityTypes = await EntityType.findAll({
			where: { id: entityTypeIds, status: common.STATUS_ACTIVE },
			raw: true,
			attributes: attributes,
		})

		const result = EntityTypes

		return result
	} catch (error) {
		throw error
	}
}

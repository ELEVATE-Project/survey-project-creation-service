'use strict'

const { EntityModelMapping, EntityType, Entity } = require('../models/index')
const defaultOrgId = process.env.DEFAULT_ORGANISATION_CODE
const { removeDefaultOrgEntityTypes } = require('@generics/utils')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const { Op } = require('sequelize')

exports.create = async (data) => {
	try {
		return await EntityModelMapping.create(data)
	} catch (error) {
		throw error
	}
}

exports.findEntityTypesAndEntities = async (filter, organization_code, tenantCode, attributes = {}) => {
	try {
		if (!defaultOrgId)
			return responses.failureResponse({
				message: 'DEFAULT_ORG_ID_NOT_SET',
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})

		const entityModelMappingData = await EntityModelMapping.findAll({
			where: {
				...filter,
				organization_code: {
					[Op.in]: [organization_code, defaultOrgId],
				},
				tenant_code: tenantCode,
			},
			include: [
				{
					model: EntityType,
					as: 'EntityType',
					required: false,
					where: {
						organization_code: {
							[Op.in]: [organization_code, defaultOrgId],
						},
						tenant_code: tenantCode,
					},
					include: [
						{
							model: Entity,
							as: 'entities',
							required: false,
							where: {
								organization_code: {
									[Op.in]: [organization_code, defaultOrgId],
								},
								tenant_code: tenantCode,
							},
						},
					],
				},
			],
			raw: false,
		})

		const EntityTypesMapping = entityModelMappingData ? entityModelMappingData.map((item) => item.toJSON()) : []
		const EntityTypes =
			EntityTypesMapping.length > 0 ? EntityTypesMapping.map((item) => item.EntityType).filter(Boolean) : []

		const prunedEntities = removeDefaultOrgEntityTypes(EntityTypes, organization_code)

		return prunedEntities
	} catch (error) {
		throw error
	}
}

exports.findAll = async (filter, options = {}) => {
	try {
		return await EntityModelMapping.findAll({
			where: filter,
			...options,
			raw: true,
		})
	} catch (error) {
		throw error
	}
}

exports.bulkCreate = async (data) => {
	try {
		return await EntityModelMapping.bulkCreate(data)
	} catch (error) {
		throw error
	}
}

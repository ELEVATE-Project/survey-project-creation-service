'use strict'
require('module-alias/register')
const common = require('@constants/common')
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
		if (!defaultTenantCode) {
			throw new Error('DEFAULT_TENANT_CODE environment variable is undefined. Please make sure it is set.')
		}

		let entityTypeArray = [
			{
				entityType: 'start_date',
				has_entities: false,
				validation: [
					{
						type: 'required',
						value: true,
						message: 'Start Date is Mandatory.',
					},
				],
				model: ['rollouts'],
			},
			{
				entityType: 'end_date',
				has_entities: false,
				validation: [
					{
						type: 'required',
						value: true,
						message: 'End Date is Mandatory.',
					},
					{
						type: 'end_date_check',
						value: true,
						message: 'End date should be greater than the start date',
					},
				],
				model: ['rollouts'],
			},
			{
				entityType: 'viewers',
				has_entities: false,
				validation: [
					{
						type: 'required',
						value: true,
						message: 'Data Managers should not be empty.',
					},
				],
				model: ['rollouts'],
			},
			{
				entityType: 'targeting_criteria',
				has_entities: false,
				validation: [
					{
						type: 'required',
						value: true,
						message: 'Targeting Criteria should not be empty.',
					},
				],
				model: ['rollouts'],
			},
			{
				entityType: 'resource_id',
				has_entities: false,
				validation: [
					{
						type: 'required',
						value: true,
						message: 'Resource cannot be empty.',
					},
				],
				model: ['rollouts'],
			},
		]

		//add entity type details
		const entityTypeFinalArray = entityTypeArray.map((entity) => {
			const { entityType, has_entities, validation, model } = entity
			return {
				value: entityType,
				label: convertToWords(entityType),
				data_type: 'ARRAY[STRING]',
				status: common.STATUS_ACTIVE,
				updated_at: new Date(),
				created_at: new Date(),
				created_by: 0,
				updated_by: 0,
				allow_filtering: false,
				organization_code: defaultOrgId,
				tenant_code: defaultTenantCode,
				has_entities,
				allow_custom_entities: false,
				validations: validation ? JSON.stringify(validation) : null,
			}
		})

		//create entity type
		await queryInterface.bulkInsert('entity_types', entityTypeFinalArray, {})
		//update entityTypeArray array. add title to for entity model mapping
		entityTypeArray.push({
			entityType: common.ROLLOUT_TITLE,
			model: ['rollouts'],
		})

		const entityTypes = await queryInterface.sequelize.query('SELECT * FROM entity_types', {
			type: queryInterface.sequelize.QueryTypes.SELECT,
		})

		//create entity model mapping
		let entityModelMapping = []
		entityTypeArray.map((entity) => {
			const entityType = entityTypes.find((type) => type.value === entity.entityType)
			if (entityType) {
				for (let pointerToModel = 0; pointerToModel < entity.model.length; pointerToModel++) {
					let data = {
						entity_type_id: entityType.id,
						tenant_code: defaultTenantCode,
						organization_code: defaultOrgId,
						model: entity.model[pointerToModel],
						status: common.STATUS_ACTIVE,
						updated_at: new Date(),
						created_at: new Date(),
					}
					entityModelMapping.push(data)
				}
			}
		})

		await queryInterface.bulkInsert('entities_model_mapping', entityModelMapping, {})
	},

	async down(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		const defaultTenantCode = process.env.DEFAULT_TENANT_CODE
		const values = ['start_date','end_date','viewers','targeting_criteria','resource_id', common.ROLLOUT_TITLE]
		const ids = await queryInterface.sequelize.query(
		`SELECT id FROM entity_types 
			WHERE organization_code = :org AND tenant_code = :tenant AND value IN (:values)`,
		{ type: queryInterface.sequelize.QueryTypes.SELECT, replacements: { org: defaultOrgId, tenant: defaultTenantCode, values } }
		)
		 
		const entityTypeIds = ids.map(r => r.id)
		if (entityTypeIds.length) {
		await queryInterface.sequelize.query(
			`DELETE FROM entities_model_mapping 
			WHERE organization_code = :org AND tenant_code = :tenant AND model = 'rollouts' 
				AND entity_type_id IN (:ids)`,
			{ type: queryInterface.sequelize.QueryTypes.DELETE, replacements: { org: defaultOrgId, tenant: defaultTenantCode, ids: entityTypeIds } }
		)
		await queryInterface.sequelize.query(
			`DELETE FROM entity_types 
			WHERE organization_code = :org AND tenant_code = :tenant AND value IN (:values)`,
			{ type: queryInterface.sequelize.QueryTypes.DELETE, replacements: { org: defaultOrgId, tenant: defaultTenantCode, values } }
		)
		}
	},
}

function convertToWords(inputString) {
	const words = inputString.replace(/_/g, ' ').split(' ')

	const capitalizedWords = words.map((word) => {
		return word.charAt(0).toUpperCase() + word.slice(1)
	})

	const result = capitalizedWords.join(' ')

	return result
}

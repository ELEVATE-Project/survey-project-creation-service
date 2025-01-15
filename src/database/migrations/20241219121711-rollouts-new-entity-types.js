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
				organization_id: defaultOrgId,
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

	async down(queryInterface, Sequelize) {},
}

function convertToWords(inputString) {
	const words = inputString.replace(/_/g, ' ').split(' ')

	const capitalizedWords = words.map((word) => {
		return word.charAt(0).toUpperCase() + word.slice(1)
	})

	const result = capitalizedWords.join(' ')

	return result
}

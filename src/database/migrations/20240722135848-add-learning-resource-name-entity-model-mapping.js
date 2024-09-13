'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		//add model mapping for learning resource
		const fetchEntityType = await queryInterface.sequelize.query(
			'SELECT id, value FROM entity_types WHERE value IN (:values) AND organization_id = :defaultOrgId',
			{
				type: queryInterface.sequelize.QueryTypes.SELECT,
				replacements: { values: ['learning_resources', 'name'], defaultOrgId },
			}
		)
		const entityTypeIdMap = fetchEntityType.reduce((acc, item) => {
			acc[item.value] = item.id
			return acc
		}, {})
		let entity_model_mapping_bulk_insert = [
			{
				entity_type_id: entityTypeIdMap['learning_resources'],
				model: 'project',
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
			},
			{
				entity_type_id: entityTypeIdMap['learning_resources'],
				model: 'tasks',
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
			},
			{
				entity_type_id: entityTypeIdMap['name'],
				model: 'subTasks',
				status: 'ACTIVE',
				updated_at: new Date(),
				created_at: new Date(),
			},
		]
		for (const key in entityTypeIdMap) {
			if (entityTypeIdMap.hasOwnProperty(key)) {
				entity_model_mapping_bulk_insert.push()
			}
		}
		await queryInterface.bulkInsert('entities_model_mapping', entity_model_mapping_bulk_insert, {})
	},
	async down(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		const entity_model_relation = {
			learning_resources: 'project',
			name: 'subTasks',
		}

		// Fetch entity types to identify which rows to delete
		const fetchEntityType = await queryInterface.sequelize.query(
			'SELECT id, value FROM entity_types WHERE value IN (:values) AND organization_id = :defaultOrgId',
			{
				type: queryInterface.sequelize.QueryTypes.SELECT,
				replacements: { values: ['learning_resources', 'name'], defaultOrgId },
			}
		)

		const entityTypeIdMap = fetchEntityType.reduce((acc, item) => {
			acc[item.value] = item.id
			return acc
		}, {})

		let entityTypeIds = []
		for (const key in entityTypeIdMap) {
			if (entityTypeIdMap.hasOwnProperty(key)) {
				entityTypeIds.push(entityTypeIdMap[key])
			}
		}

		// Delete the inserted rows
		await queryInterface.bulkDelete('entities_model_mapping', {
			entity_type_id: {
				[Sequelize.Op.in]: entityTypeIds,
			},
			model: {
				[Sequelize.Op.in]: Object.values(entity_model_relation),
			},
		})
	},
}

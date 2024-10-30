'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		let entityTypeValue = 'duration'
		const entityType = await queryInterface.sequelize.query(
			`SELECT * FROM entity_types WHERE value IN (:entityTypeValue)`,
			{
				type: queryInterface.sequelize.QueryTypes.SELECT,
				replacements: { entityTypeValue },
			}
		)

		// Handle case where the entity type is not found
		if (!entityType.length) {
			throw new Error(`Entity type '${entityTypeValue}' not found.`)
		}

		const entityTypeId = entityType[0].id
		const deletedModelMappingRows = await queryInterface.bulkDelete(
			'entities_model_mapping',
			{
				entity_type_id: entityTypeId,
			},
			{}
		)

		if (!deletedModelMappingRows) {
			console.log(`No mappings found for entity_type_id ${entityTypeId}.`)
		} else {
			console.log(`Deleted ${deletedModelMappingRows} mappings for entity_type_id ${entityTypeId}.`)
		}
	},

	async down(queryInterface, Sequelize) {
		/**
		 * Add reverting commands here.
		 *
		 * Example:
		 * await queryInterface.dropTable('users');
		 */
	},
}

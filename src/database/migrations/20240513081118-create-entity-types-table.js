'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('entity_types', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			value: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			label: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			status: {
				allowNull: false,
				type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
				defaultValue: 'ACTIVE',
			},
			allow_filtering: {
				type: Sequelize.BOOLEAN,
			},
			data_type: {
				type: Sequelize.STRING,
			},
			organization_id: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			parent_id: {
				type: Sequelize.INTEGER,
			},
			has_entities: {
				type: Sequelize.BOOLEAN,
			},
			allow_custom_entities: {
				type: Sequelize.BOOLEAN,
			},
			validations: {
				type: Sequelize.JSON,
			},
			created_by: {
				type: Sequelize.STRING,
			},
			updated_by: {
				type: Sequelize.STRING,
			},
			created_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			updated_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			deleted_at: {
				type: Sequelize.DATE,
			},
		})

		// Add an index for the 'value' column
		await queryInterface.addIndex('entity_types', ['value', 'organization_id'], {
			unique: true,
			name: 'unique_value_org_id',
			where: {
				deleted_at: null,
			},
		})
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('entity_types')
	},
}

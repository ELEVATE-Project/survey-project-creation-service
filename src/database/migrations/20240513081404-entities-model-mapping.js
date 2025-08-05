'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('entities_model_mapping', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			entity_type_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
			},
			model: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			status: {
				type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
				defaultValue: 'ACTIVE',
			},
			organization_code: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			tenant_code: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			created_at: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			updated_at: {
				type: Sequelize.DATE,
			},
			deleted_at: {
				type: Sequelize.DATE,
			},
		})

		// Add an index for the 'value' column
		await queryInterface.addIndex('entities_model_mapping', ['entity_type_id', 'model', 'tenant_code'], {
			unique: true,
			name: 'unique_entity_type_id_model_tenant_code',
			where: {
				deleted_at: null,
			},
		})

		await queryInterface.addConstraint('entities_model_mapping', {
			fields: ['entity_type_id', 'tenant_code'],
			type: 'foreign key',
			name: 'fk_entities_model_mapping_entity_type',
			references: {
				table: 'entity_types',
				fields: ['id', 'tenant_code'],
			},
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('entities_model_mapping')
	},
}

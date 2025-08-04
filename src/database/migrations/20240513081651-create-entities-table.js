'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('entities', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			entity_type_id: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			value: {
				type: Sequelize.STRING,
			},
			label: {
				type: Sequelize.STRING,
			},
			status: {
				type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
				defaultValue: 'ACTIVE',
			},
			type: {
				type: Sequelize.STRING,
			},
			tenant_code: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			created_by: {
				allowNull: false,
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
		await queryInterface.addIndex('entities', ['value', 'entity_type_id', 'tenant_code'], {
			unique: true,
			name: 'unique_entities_value_type_tenant',
			where: {
				deleted_at: null,
			},
		})
		await queryInterface.addConstraint('entities', {
			fields: ['entity_type_id', 'tenant_code'],
			type: 'foreign key',
			name: 'fk_entities_entity_type',
			references: {
				table: 'entity_types',
				fields: ['id', 'tenant_code'],
			},
		})
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('entities')
	},
}

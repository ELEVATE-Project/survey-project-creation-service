'use strict'
require('module-alias/register')
const common = require('@constants/common')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Add parent_id column. We will add a composite foreign key constraint
		// referencing (id, organization_code, tenant_code) because `id` alone
		// is not unique in this schema (resources uses a composite unique key).
		// NOTE: existing data may not have parent_id set. To avoid migration
		// failure on databases with NULLs, create this column as nullable.
		// A follow-up migration should backfill and then set NOT NULL if needed.
		await queryInterface.addColumn('resources', 'parent_id', {
			allowNull: true,
			type: Sequelize.INTEGER,
		})

		// Add an index on parent_id for faster lookups of children by parent
		await queryInterface.addIndex('resources', ['parent_id'], {
			name: 'idx_resources_parent_id',
		})

		// Add composite foreign key constraint: (parent_id, organization_code, tenant_code)
		// -> (id, organization_code, tenant_code) on resources table
		await queryInterface.addConstraint('resources', {
			fields: ['parent_id', 'organization_code', 'tenant_code'],
			type: 'foreign key',
			name: 'fk_resources_parent',
			references: {
				table: 'resources',
				fields: ['id', 'organization_code', 'tenant_code'],
			},
			onUpdate: 'CASCADE',
			onDelete: 'RESTRICT',
		})

		await queryInterface.addColumn('resources', 'version', {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: common.DEFAULT_RESOURCE_VERSION,
		})
	},

	async down(queryInterface, Sequelize) {
		/**
		 * Add reverting commands here.
		 *
		 * Example:
		 * await queryInterface.dropTable('resources');
		 */
		// Remove the composite foreign key constraint, index, then columns
		await queryInterface.removeConstraint('resources', 'fk_resources_parent')
		await queryInterface.removeIndex('resources', 'idx_resources_parent_id')
		await queryInterface.removeColumn('resources', 'parent_id')
		await queryInterface.removeColumn('resources', 'version')
	},
}

'use strict'

/**
 * Fix resources self-referencing FK for Citus compatibility.
 *
 * Changes fk_resources_parent from ON UPDATE CASCADE to ON UPDATE NO ACTION.
 * Citus does not support CASCADE on UPDATE when the distribution key (tenant_code) is in the FK.
 *
 * NOTE: On fresh databases, parent_id may not exist yet at migration time (it is added by model sync after migrations).
 * In that case, this migration safely skips — the FK will be created correctly by model sync with the right settings.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			// Check if parent_id column exists (on fresh DBs it may not exist yet at migration time)
			const [columns] = await queryInterface.sequelize.query(
				`
				SELECT column_name FROM information_schema.columns
				WHERE table_name = 'resources' AND column_name = 'parent_id';
			`,
				{ transaction }
			)

			if (!columns || columns.length === 0) {
				console.log('parent_id column not yet present (fresh DB). Skipping — model sync will handle it.')
				await transaction.commit()
				return
			}

			// Drop the existing FK constraint if it exists
			const [results] = await queryInterface.sequelize.query(
				`
				SELECT constraint_name
				FROM information_schema.table_constraints
				WHERE table_name = 'resources'
				AND constraint_name = 'fk_resources_parent'
				AND constraint_type = 'FOREIGN KEY';
			`,
				{ transaction }
			)

			if (results && results.length > 0) {
				await queryInterface.removeConstraint('resources', 'fk_resources_parent', { transaction })
				console.log('Removed existing constraint: fk_resources_parent')
			}

			// Re-add with ON UPDATE NO ACTION (Citus compatible)
			await queryInterface.addConstraint('resources', {
				fields: ['parent_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_resources_parent',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onDelete: 'RESTRICT',
				onUpdate: 'NO ACTION',
				transaction,
			})
			console.log('Added constraint: fk_resources_parent (ON UPDATE NO ACTION)')

			await transaction.commit()
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	},

	async down(queryInterface, Sequelize) {
		const transaction = await queryInterface.sequelize.transaction()
		try {
			const [columns] = await queryInterface.sequelize.query(
				`
				SELECT column_name FROM information_schema.columns
				WHERE table_name = 'resources' AND column_name = 'parent_id';
			`,
				{ transaction }
			)

			if (!columns || columns.length === 0) {
				console.log('parent_id column not present. Skipping revert.')
				await transaction.commit()
				return
			}

			const [results] = await queryInterface.sequelize.query(
				`
				SELECT constraint_name
				FROM information_schema.table_constraints
				WHERE table_name = 'resources'
				AND constraint_name = 'fk_resources_parent';
			`,
				{ transaction }
			)

			if (results && results.length > 0) {
				await queryInterface.removeConstraint('resources', 'fk_resources_parent', { transaction })
			}

			await queryInterface.addConstraint('resources', {
				fields: ['parent_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_resources_parent',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onDelete: 'RESTRICT',
				onUpdate: 'CASCADE',
				transaction,
			})
			console.log('Reverted constraint: fk_resources_parent (ON UPDATE CASCADE)')

			await transaction.commit()
		} catch (error) {
			await transaction.rollback()
			throw error
		}
	},
}

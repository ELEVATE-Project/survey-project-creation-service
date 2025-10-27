'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.sequelize.transaction(async (transaction) => {
			// Helper function to safely add constraint
			const addConstraintSafely = async (table, constraint) => {
				try {
					await queryInterface.addConstraint(table, { ...constraint, transaction })
					console.log(`✓ Added constraint ${constraint.name} to ${table}`)
				} catch (error) {
					console.error(`✗ Failed to add constraint ${constraint.name} to ${table}:`, error.message)
					throw error
				}
			}
			await queryInterface.createTable('program_resource_mapping', {
				id: {
					type: Sequelize.INTEGER,
					primaryKey: true,
					autoIncrement: true,
				},
				program_id: {
					type: Sequelize.INTEGER,
					primaryKey: true,
					allowNull: false,
				},
				resource_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
				},
				organization_code: {
					type: Sequelize.STRING,
					allowNull: false,
				},
				tenant_code: {
					type: Sequelize.STRING,
					allowNull: false,
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

			await queryInterface.addIndex('program_resource_mapping', ['program_id', 'resource_id', 'tenant_code'], {
				unique: true,
				name: 'unique_program_resource_tenant',
			})

			await addConstraintSafely('program_resource_mapping', {
				fields: ['program_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_program_resource_mapping_program_id_org_code_tenant_code',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onUpdate: 'NO ACTION',
				onDelete: 'CASCADE',
			})
			await addConstraintSafely('program_resource_mapping', {
				fields: ['resource_id', 'organization_code', 'tenant_code'],
				type: 'foreign key',
				name: 'fk_program_resource_mapping_resource_id_org_code_tenant_code',
				references: {
					table: 'resources',
					fields: ['id', 'organization_code', 'tenant_code'],
				},
				onUpdate: 'NO ACTION',
				onDelete: 'CASCADE',
			})
		})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('program_resource_mapping')
	},
}

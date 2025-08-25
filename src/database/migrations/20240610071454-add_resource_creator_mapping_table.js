'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
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
			await queryInterface.createTable(
				'resource_creator_mapping',
				{
					id: {
						allowNull: false,
						autoIncrement: true,
						type: Sequelize.INTEGER,
					},
					resource_id: {
						allowNull: false,
						type: Sequelize.INTEGER,
					},
					creator_id: {
						allowNull: false,
						type: Sequelize.STRING,
					},
					organization_code: {
						allowNull: false,
						type: Sequelize.STRING,
					},
					tenant_code: {
						allowNull: false,
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
				},
				{
					indexes: [
						{
							unique: true,
							fields: ['resource_id', 'creator_id', 'organization_code', 'tenant_code'],
							name: 'unique_creator_resource_org_tenant',
							where: {
								deleted_at: null,
							},
						},
					],
					transaction,
				}
			)

			await addConstraintSafely(
				'resource_creator_mapping',
				{
					type: 'primary key',
					name: 'pk_resource_creator_mapping',
					fields: ['id', 'resource_id', 'creator_id'],
				},
				{ transaction }
			)

			await addConstraintSafely(
				'resource_creator_mapping',
				{
					fields: ['resource_id', 'organization_code', 'tenant_code'],
					type: 'foreign key',
					name: 'fk_resource_creator_mapping_resource_id_org_code_tenant_code',
					references: {
						table: 'resources',
						fields: ['id', 'organization_code', 'tenant_code'],
					},
					onUpdate: 'NO ACTION',
					onDelete: 'CASCADE',
				},
				{ transaction }
			)
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.sequelize.transaction(async (transaction) => {
			await queryInterface.dropTable('resource_creator_mapping', { transaction })
		})
	},
}

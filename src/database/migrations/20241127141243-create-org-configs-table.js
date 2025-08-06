'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('organization_configs', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
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
			meta: {
				allowNull: true,
				type: Sequelize.JSONB,
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
		await queryInterface.addIndex('organization_configs', ['organization_code', 'tenant_code'], {
			unique: true,
			name: 'unique_org_tenant',
			where: {
				deleted_at: null,
			},
		})
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('organization_configs')
	},
}

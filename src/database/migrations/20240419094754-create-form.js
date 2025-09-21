'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('forms', {
			id: {
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
				type: Sequelize.INTEGER,
			},
			type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			sub_type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			data: Sequelize.JSON,
			version: {
				allowNull: false,
				defaultValue: 0,
				type: Sequelize.INTEGER,
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
		})
		// await queryInterface.addConstraint('forms', {
		// 	fields: ['type', 'sub_type', 'organization_code', 'tenant_code'],
		// 	type: 'unique',
		// 	name: 'unique_type_sub_type_org_id_tenant_code',
		// })

		await queryInterface.addIndex(
			'forms',
			['type', 'sub_type', 'organization_code', 'tenant_code'],
			{
				unique: true,
				name: 'unique_type_sub_type_org_id_tenant_code',
				where: { deleted_at: null }
			}
		)
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('forms')
	},
}

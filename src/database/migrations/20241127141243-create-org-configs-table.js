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
			organization_id: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			data_manager_roles: {
				allowNull: true,
				type: Sequelize.ARRAY(Sequelize.STRING),
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
		await queryInterface.addIndex('organization_configs', ['organization_id'], {
			unique: true,
			name: 'unique_organization_id',
			where: {
				deleted_at: null,
			},
		})
	},
	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('organization_configs')
	},
}

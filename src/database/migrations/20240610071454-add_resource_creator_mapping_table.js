'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('resource_creator_mapping', {
			id: {
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
				type: Sequelize.INTEGER,
			},
			resource_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
			},
			creator_id: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			organization_id: {
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
		})

		// Add an index for the 'value' column
		await queryInterface.addIndex('resource_creator_mapping', ['resource_id', 'creator_id'], {
			unique: true,
			name: 'unique_creator_resource',
			where: {
				deleted_at: null,
			},
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('resource_creator_mapping')
	},
}

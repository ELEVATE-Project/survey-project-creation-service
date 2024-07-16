'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('certificate_base_templates', {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
			},
			organization_id: {
				type: Sequelize.STRING,
				primaryKey: true,
				allowNull: false,
			},
			code: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			url: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			resource_type: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			meta: {
				type: Sequelize.JSON,
			},
			created_by: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			updated_by: {
				type: Sequelize.STRING,
				allowNull: true,
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
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('certificate_base_templates')
	},
}

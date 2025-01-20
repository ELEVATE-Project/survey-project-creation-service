'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable('program_resource_mapping', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			program_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			resource_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			organization_id: {
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

		await queryInterface.addIndex('program_resource_mapping', ['program_id', 'resource_id'], {
			unique: true,
			name: 'unique_program_resource',
		})
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable('program_resource_mapping')
	},
}

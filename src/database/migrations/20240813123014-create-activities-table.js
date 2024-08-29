'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('activities', {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			user_id: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			action_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
			},
			object_id: {
				allowNull: false,
				primaryKey: true,
				type: Sequelize.STRING,
			},
			object_type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			organization_id: {
				allowNull: false,
				type: Sequelize.STRING,
				primaryKey: true,
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
		//add index
		await queryInterface.addIndex('activities', ['object_id'], {
			name: 'activities_index_object_id',
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('activities')
	},
}

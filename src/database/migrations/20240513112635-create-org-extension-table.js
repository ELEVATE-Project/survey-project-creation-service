'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('organization_extensions', {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
			},
			organization_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
			},
			review_required: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			show_reviewer_list: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			min_approval: {
				type: Sequelize.INTEGER,
				allowNull: false,
				defaultValue: 1,
			},
			resource_type: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			review_type: {
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
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('organization_extensions')
	},
}

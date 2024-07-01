'use strict'
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('organization_extensions', {
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
			resource_type: {
				allowNull: false,
				type: Sequelize.STRING,
			},
			review_required: {
				allowNull: false,
				type: Sequelize.BOOLEAN,
			},
			show_reviewer_list: {
				allowNull: false,
				defaultValue: true,
				type: Sequelize.BOOLEAN,
			},
			min_approval: {
				allowNull: false,
				defaultValue: 1,
				type: Sequelize.INTEGER,
			},
			review_type: {
				allowNull: false,
				type: Sequelize.ENUM('SEQUENTIAL', 'PARALLEL'),
				defaultValue: 'SEQUENTIAL',
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

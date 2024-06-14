'use strict'

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('reviews', {
			resource_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
				primaryKey: true,
			},
			reviewer_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
				primaryKey: true,
			},
			organization_id: {
				allowNull: false,
				type: Sequelize.INTEGER,
			},
		})

		// Add composite primary key on resource_id and reviewer_id
		await queryInterface.addConstraint('reviews', {
			fields: ['resource_id', 'reviewer_id'],
			type: 'primary key',
			name: 'reviews_pkey',
		})
	},

	async down(queryInterface, Sequelize) {
		// Remove the composite primary key
		await queryInterface.removeConstraint('reviews', 'reviews_pkey')
	},
}

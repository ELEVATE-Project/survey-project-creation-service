'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Add composite primary key on resource_id and reviewer_id
		await queryInterface.removeConstraint('reviews', 'reviews_pkey')
		await queryInterface.addConstraint('reviews', {
			fields: ['resource_id', 'reviewer_id'],
			type: 'primary key',
			name: 'reviews_resource_id_reviewer_id_pkey',
		})
	},

	async down(queryInterface, Sequelize) {
		// Remove the composite primary key
		await queryInterface.removeConstraint('reviews', 'reviews_resource_id_reviewer_id_pkey')
	},
}

'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		return queryInterface.bulkUpdate(
			'entities',
			{
				value: 'project',
				updated_at: new Date(),
			},
			{
				value: 'projects',
			}
		)
	},

	async down(queryInterface, Sequelize) {
		return queryInterface.bulkUpdate(
			'entities',
			{
				value: 'projects',
				updated_at: new Date(),
			},
			{
				value: 'project',
			}
		)
	},
}

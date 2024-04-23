'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}
		const permissions = [
			{
				code: 'permissions',
				module: 'permissions',
				request_type: ['POST', 'DELETE', 'GET', 'PUT', 'PATCH'],
				api_path: '/mentoring/v1/permissions/*',
				status: 'ACTIVE',
				created_at: new Date(),
				updated_at: new Date(),
			},
		]

		await queryInterface.bulkInsert('permissions', permissions, {})
	},

	async down(queryInterface, Sequelize) {
		const defaultOrgId = queryInterface.sequelize.options.defaultOrgId
		if (!defaultOrgId) {
			throw new Error('Default org ID is undefined. Please make sure it is set in sequelize options.')
		}

		await queryInterface.bulkDelete('permissions', null, {})
	},
}

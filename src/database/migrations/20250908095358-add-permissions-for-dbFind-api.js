'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const modulesData = [{ code: 'admin', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() }]

		await queryInterface.bulkInsert('modules', modulesData)

		const permissionsData = [
			{
				code: 'db_find',
				module: 'admin',
				request_type: ['POST'],
				api_path: '/scp/v1/admin/dbFind',
				status: 'ACTIVE',
				created_at: new Date(),
				updated_at: new Date(),
			},
		]
		await queryInterface.bulkInsert('permissions', permissionsData)
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('permissions', { code: 'db_find' }, {})
		await queryInterface.bulkDelete('modules', { code: 'admin' })
	},
}

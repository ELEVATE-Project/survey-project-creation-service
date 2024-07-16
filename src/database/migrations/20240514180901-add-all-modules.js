'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('modules', null, {})

		const modulesData = [
			{ code: 'all', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'resources', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'modules', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'permissions', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'cloud-services', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'entity-types', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'entities', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'form', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'organization-extensions', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'config', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'comments', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'projects', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'role-permission-mapping', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'certificates', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'reviews', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
			{ code: 'observations', status: 'ACTIVE', created_at: new Date(), updated_at: new Date() },
		]

		// Insert the data into the 'modules' table
		await queryInterface.bulkInsert('modules', modulesData)
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.bulkDelete('modules', null, {})
	},
}

'use strict'

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('comments', 'page_temp', {
			type: Sequelize.STRING,
		})

		await queryInterface.sequelize.query(`
      UPDATE comments SET page_temp = CAST(page AS VARCHAR)
    `)

		await queryInterface.removeColumn('comments', 'page')

		await queryInterface.renameColumn('comments', 'page_temp', 'page')
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn('comments', 'page_temp', {
			type: Sequelize.INTEGER,
		})

		await queryInterface.sequelize.query(`
      UPDATE comments SET page_temp = CAST(page AS INTEGER)
    `)

		await queryInterface.removeColumn('comments', 'page')

		await queryInterface.renameColumn('comments', 'page_temp', 'page')
	},
}

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('organization_extensions', 'enable_entity_tagging', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		})

		await queryInterface.addColumn('organization_extensions', 'enable_task_start_end_dates', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		})
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('organization_extensions', 'enable_task_start_end_dates')
		await queryInterface.removeColumn('organization_extensions', 'enable_entity_tagging')
	},
}

module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('organization_extensions', 'enable_entity_tagging', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		})
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.removeColumn('organization_extensions', 'enable_entity_tagging')
	},
}

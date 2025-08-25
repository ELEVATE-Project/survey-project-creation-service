'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			'comments',
			{
				id: {
					allowNull: false,
					autoIncrement: true,
					primaryKey: true,
					type: Sequelize.INTEGER,
				},
				resource_id: {
					allowNull: false,
					primaryKey: true,
					type: Sequelize.INTEGER,
				},
				organization_code: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				tenant_code: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				comment: {
					allowNull: false,
					type: Sequelize.TEXT,
				},
				user_id: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				parent_id: {
					allowNull: false,
					defaultValue: 0,
					type: Sequelize.INTEGER,
				},
				status: {
					allowNull: false,
					type: Sequelize.ENUM('OPEN', 'RESOLVED', 'DRAFT'),
					defaultValue: 'DRAFT',
				},
				resolved_by: {
					type: Sequelize.STRING,
				},
				resolved_at: {
					type: Sequelize.DATE,
				},
				context: {
					allowNull: false,
					defaultValue: 'page',
					type: Sequelize.STRING,
				},
				page: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				is_read: {
					allowNull: false,
					defaultValue: false,
					type: Sequelize.BOOLEAN,
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
			},
			{
				indexes: [
					{
						unique: true,
						fields: ['id', 'resource_id', 'organization_code', 'tenant_code'],
						name: 'unique_comment_resource',
						where: {
							deleted_at: null,
						},
					},
				],
			}
		)

		// Add foreign key constraint for resource_id, organization_code, and tenant_code
		await queryInterface.addConstraint('comments', {
			fields: ['resource_id', 'organization_code', 'tenant_code'],
			type: 'foreign key',
			name: 'fk_comments_resources',
			references: {
				table: 'resources',
				fields: ['id', 'organization_code', 'tenant_code'],
			},
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE',
		})
	},

	async down(queryInterface, Sequelize) {
		// Remove the foreign key constraint before dropping the table
		await queryInterface.removeConstraint('comments', 'fk_comments_resources')
		await queryInterface.dropTable('comments')
	},
}

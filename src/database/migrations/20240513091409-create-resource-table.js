'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			'resources',
			{
				id: {
					allowNull: false,
					autoIncrement: true,
					primaryKey: true,
					type: Sequelize.INTEGER,
				},
				title: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				type: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				status: {
					allowNull: false,
					type: Sequelize.ENUM(
						'DRAFT',
						'SUBMITTED',
						'IN_REVIEW',
						'NOT_STARTED',
						'INPROGRESS',
						'REQUESTED_FOR_CHANGES',
						'APPROVED',
						'REJECTED',
						'PUBLISHED',
						'REJECTED_AND_REPORTED'
					),
					defaultValue: 'DRAFT',
				},
				stage: {
					allowNull: false,
					type: Sequelize.ENUM('CREATION', 'REVIEW', 'COMPLETION'),
					defaultValue: 'CREATION',
				},
				blob_path: {
					allowNull: true,
					type: Sequelize.STRING,
				},
				user_id: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				organization_code: {
					primaryKey: true,
					allowNull: false,
					type: Sequelize.STRING,
				},
				tenant_code: {
					primaryKey: true,
					allowNull: false,
					type: Sequelize.STRING,
				},
				next_stage: {
					type: Sequelize.INTEGER,
				},
				review_type: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				reference_id: {
					type: Sequelize.INTEGER,
				},
				published_id: {
					type: Sequelize.STRING,
				},
				meta: {
					allowNull: true,
					type: Sequelize.JSONB,
				},
				link: {
					allowNull: true,
					type: Sequelize.STRING,
				},
				submitted_on: {
					type: Sequelize.DATE,
					allowNull: true,
				},
				published_on: {
					type: Sequelize.DATE,
					allowNull: true,
				},
				is_under_edit: {
					type: Sequelize.BOOLEAN,
					defaultValue: false,
				},
				is_reusable: {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: true, // Default value set to true
				},
				created_at: {
					allowNull: false,
					type: Sequelize.DATE,
				},
				created_by: {
					allowNull: false,
					type: Sequelize.STRING,
				},
				updated_by: {
					type: Sequelize.STRING,
				},
				last_reviewed_on: {
					type: Sequelize.DATE,
					allowNull: true,
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
						name: 'title_index',
						fields: ['title'],
					},
					{
						name: 'resources_stage_index',
						fields: ['stage'],
					},
					{
						unique: true,
						name: 'unique_creator_resource',
						fields: ['id', 'organization_code', 'tenant_code'],
						where: {
							deleted_at: null,
						},
					},
				],
			}
		)
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('resources')
	},
}

module.exports = (sequelize, DataTypes) => {
	const Resource = sequelize.define(
		'Resource',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			title: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			status: {
				allowNull: false,
				type: DataTypes.ENUM(
					'DRAFT',
					'SUBMITTED',
					'IN_REVIEW',
					'APPROVED',
					'REJECTED',
					'PUBLISHED',
					'REJECTED_AND_REPORTED'
				),
				defaultValue: 'DRAFT',
			},
			blob_path: {
				allowNull: true,
				type: DataTypes.STRING,
			},
			user_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			organization_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			next_stage: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 1,
			},
			review_type: {
				allowNull: false,
				type: DataTypes.ENUM('SEQUENTIAL', 'PARALLEL'),
				defaultValue: 'SEQUENTIAL',
			},
			reference_id: {
				type: DataTypes.INTEGER,
			},
			meta: {
				allowNull: false,
				type: DataTypes.JSONB,
			},
			published_id: {
				type: DataTypes.STRING,
			},
			created_by: {
				type: DataTypes.STRING,
			},
			updated_by: {
				type: DataTypes.STRING,
			},
		},
		{
			modelName: 'Resource',
			tableName: 'resources',
			freezeTableName: true,
			paranoid: false,
			indexes: [
				{
					name: 'title_index',
					fields: ['title'],
				},
			],
		}
	)

	return Resource
}

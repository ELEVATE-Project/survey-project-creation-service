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
			status: {
				allowNull: false,
				type: DataTypes.ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED'),
				defaultValue: 'DRAFT',
			},
			blob_path: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			user_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			organization_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			published_id: {
				type: DataTypes.STRING,
			},
			next_stage: {
				type: DataTypes.INTEGER,
			},
			review_type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			reference_id: {
				type: DataTypes.INTEGER,
			},
			meta: {
				allowNull: false,
				type: DataTypes.JSONB,
			},
			created_by: {
				type: DataTypes.INTEGER,
			},
			updated_by: {
				type: DataTypes.INTEGER,
			},
		},
		{
			modelName: 'Resource',
			tableName: 'resources',
			freezeTableName: true,
			paranoid: false,
		}
	)

	return Resource
}

module.exports = (sequelize, DataTypes) => {
	const ReviewResource = sequelize.define(
		'ReviewResource',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			resource_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			reviewer_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
			},
			organization_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			tenant_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
		},
		{
			modelName: 'ReviewResource',
			tableName: 'review_resources',
			freezeTableName: true,
			paranoid: true,
		}
	)

	// Define associations (foreign key constraints)
	ReviewResource.associate = (models) => {
		ReviewResource.belongsTo(models.Resource, {
			foreignKey: 'resource_id',
			targetKey: 'id',
			as: 'ReviewResource',
			onUpdate: 'NO ACTION',
			onDelete: 'CASCADE',
		})
	}

	return ReviewResource
}

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
			organization_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
		},
		{
			modelName: 'ReviewResource',
			tableName: 'review_resources',
			freezeTableName: true,
			paranoid: false,
		}
	)

	return ReviewResource
}

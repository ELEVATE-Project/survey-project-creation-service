module.exports = (sequelize, DataTypes) => {
	const ReviewStage = sequelize.define(
		'ReviewStage',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			role: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			level: {
				allowNull: false,
				defaultValue: 1,
				type: DataTypes.INTEGER,
			},
			resource_type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			organization_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
			},
		},
		{
			modelName: 'ReviewStage',
			tableName: 'review_stages',
			freezeTableName: true,
			paranoid: false,
		}
	)

	return ReviewStage
}

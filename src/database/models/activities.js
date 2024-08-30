module.exports = (sequelize, DataTypes) => {
	const Activity = sequelize.define(
		'Activity',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			user_id: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			action_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			object_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
			},
			object_type: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			organization_id: {
				allowNull: false,
				type: DataTypes.STRING,
				primaryKey: true,
			},
		},
		{
			modelName: 'Activity',
			tableName: 'activities',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					fields: ['object_id'],
					name: 'activities_index_object_id',
				},
			],
		}
	)

	return Activity
}

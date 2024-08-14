module.exports = (sequelize, DataTypes) => {
	const Action = sequelize.define(
		'Action',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			name: {
				allowNull: false,
				unique: true,
				type: DataTypes.STRING,
			},
			description: {
				type: DataTypes.STRING,
			},
		},
		{
			modelName: 'Action',
			tableName: 'actions',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return Action
}

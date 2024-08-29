'use strict'
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
			code: {
				allowNull: false,
				unique: true,
				type: DataTypes.STRING,
			},
			description: {
				type: DataTypes.STRING,
			},
			status: {
				allowNull: false,
				type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
				defaultValue: 'ACTIVE',
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

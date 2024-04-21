'use strict'
module.exports = (sequelize, DataTypes) => {
	const UserExtension = sequelize.define(
		'UserExtension',
		{
			user_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			name: { type: DataTypes.STRING, allowNull: false },
			org_id: { type: DataTypes.INTEGER, allowNull: false },
			roles: {
				type: DataTypes.ARRAY(DataTypes.STRING),
			},
		},
		{ sequelize, modelName: 'UserExtension', tableName: 'UserExtensions', freezeTableName: true, paranoid: true }
	)
	return UserExtension
}

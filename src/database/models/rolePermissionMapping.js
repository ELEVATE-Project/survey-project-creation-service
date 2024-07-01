module.exports = (sequelize, DataTypes) => {
	const RolePermission = sequelize.define(
		'RolePermission',
		{
			role_title: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				allowNull: false,
			},
			permission_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				allowNull: false,
			},
			module: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			request_type: {
				allowNull: false,
				type: DataTypes.ARRAY(DataTypes.STRING),
			},
			api_path: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			created_by: {
				type: DataTypes.STRING,
				allowNull: false,
			},
		},
		{
			modelName: 'RolePermission',
			tableName: 'role_permission_mapping',
			freezeTableName: true,
			paranoid: false,
		}
	)

	return RolePermission
}

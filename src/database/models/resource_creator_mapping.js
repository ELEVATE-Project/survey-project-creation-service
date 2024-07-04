module.exports = (sequelize, DataTypes) => {
	const ResourceCreatorMapping = sequelize.define(
		'ResourceCreatorMapping',
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
			creator_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			organization_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
		},
		{
			modelName: 'ResourceCreatorMapping',
			tableName: 'resource_creator_mapping',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return ResourceCreatorMapping
}

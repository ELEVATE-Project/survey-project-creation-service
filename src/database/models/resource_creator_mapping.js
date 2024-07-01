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
				type: DataTypes.STRING,
			},
			organization_id: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
			},
		},
		{
			indexes: [
				{
					unique: true,
					fields: ['resource_id', 'creator_id'],
					name: 'unique_creator_resource',
				},
			],
			modelName: 'ResourceCreatorMapping',
			tableName: 'resource_creator_mapping',
			freezeTableName: true,
			paranoid: false,
		}
	)

	return ResourceCreatorMapping
}

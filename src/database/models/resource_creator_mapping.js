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
				primaryKey: true,
			},
			organization_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
			tenant_code: {
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
					where: {
						deleted_at: null,
					},
				},
			],
			modelName: 'ResourceCreatorMapping',
			tableName: 'resource_creator_mapping',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return ResourceCreatorMapping
}

module.exports = (sequelize, DataTypes) => {
	const ProgramResourceMapping = sequelize.define(
		'ProgramResourceMapping',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			program_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
				primaryKey: true,
			},
			resource_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
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
					fields: ['program_id', 'resource_id'],
					name: 'unique_program_resource',
					where: {
						deleted_at: null,
					},
				},
			],
			modelName: 'ProgramResourceMapping',
			tableName: 'program_resource_mapping',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return ProgramResourceMapping
}

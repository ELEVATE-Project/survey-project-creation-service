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
			tenant_code: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
			},
			program_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			resource_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			organization_code: {
				allowNull: false,
				type: DataTypes.STRING,
			},
		},
		{
			indexes: [
				{
					unique: true,
					fields: ['tenant_code', 'program_id', 'resource_id'],
					name: 'unique_program_resource_tenant',
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

	// Define associations
	ProgramResourceMapping.associate = (models) => {
		ProgramResourceMapping.belongsTo(models.Resource, {
			foreignKey: 'resource_id',
			targetKey: 'id',
			as: 'resource',
			onUpdate: 'NO ACTION',
			onDelete: 'CASCADE',
		})
		ProgramResourceMapping.belongsTo(models.Resource, {
			foreignKey: 'program_id',
			targetKey: 'id',
			as: 'program',
			onUpdate: 'NO ACTION',
			onDelete: 'CASCADE',
		})
	}

	return ProgramResourceMapping
}

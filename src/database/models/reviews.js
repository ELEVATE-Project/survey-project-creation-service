module.exports = (sequelize, DataTypes) => {
	const Review = sequelize.define(
		'Review',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				type: DataTypes.INTEGER,
				primaryKey: true,
			},
			resource_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			reviewer_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
			status: {
				type: DataTypes.ENUM(
					'NOT_STARTED',
					'DRAFT',
					'STARTED',
					'INPROGRESS',
					'REQUESTED_FOR_CHANGES',
					'APPROVED',
					'REJECTED',
					'PUBLISHED'
				),
				defaultValue: 'NOT_STARTED',
			},
			organization_id: {
				allowNull: false,
				type: DataTypes.INTEGER,
			},
		},
		{
			modelName: 'Review',
			tableName: 'reviews',
			freezeTableName: true,
			paranoid: false,
			indexes: [
				{
					unique: true,
					fields: ['resource_id', 'reviewer_id'],
				},
			],
		}
	)

	return Review
}

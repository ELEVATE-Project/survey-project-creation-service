'use strict'
module.exports = (sequelize, DataTypes) => {
	const organizationExtensions = sequelize.define(
		'organizationExtensions',
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
			},
			organization_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			review_required: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			show_reviewer_list: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			min_approval: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			resource_type: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			review_type: {
				type: DataTypes.STRING,
				allowNull: false,
			},
		},
		{
			sequelize,
			modelName: 'organizationExtensions',
			tableName: 'organization_extensions',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return organizationExtensions
}

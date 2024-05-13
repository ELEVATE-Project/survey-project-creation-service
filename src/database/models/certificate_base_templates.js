'use strict'
module.exports = (sequelize, DataTypes) => {
	const CertificateBaseTemplate = sequelize.define(
		'CertificateBaseTemplate',
		{
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: DataTypes.INTEGER,
			},
			organization_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				primaryKey: true,
			},
			code: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			url: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			resource_type: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			meta: {
				type: DataTypes.JSON,
			},
		},
		{
			sequelize,
			modelName: 'CertificateBaseTemplate',
			tableName: 'certificate_base_templates',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return CertificateBaseTemplate
}

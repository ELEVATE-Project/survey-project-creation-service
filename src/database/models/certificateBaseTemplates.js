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
			organization_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			meta: {
				type: DataTypes.JSON,
			},
		},

		{
			indexes: [
				{
					unique: true,
					fields: ['code', 'organization_id'],
				},
			],
			sequelize,
			modelName: 'CertificateBaseTemplate',
			tableName: 'certificate_base_templates',
			freezeTableName: true,
			paranoid: true,
		}
	)

	return CertificateBaseTemplate
}

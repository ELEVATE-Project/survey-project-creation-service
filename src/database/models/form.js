'use strict'
module.exports = (sequelize, DataTypes) => {
	const Form = sequelize.define(
		'Form',
		{
			id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				primaryKey: true,
				autoIncrement: true,
			},
			type: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
			},
			sub_type: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			data: DataTypes.JSON,
			version: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
			organization_code: {
				type: DataTypes.STRING,
				allowNull: false,
				primaryKey: true,
			},
			tenant_code: {
				allowNull: false,
				primaryKey: true,
				type: DataTypes.STRING,
			},
		},
		{
			sequelize,
			modelName: 'Form',
			tableName: 'forms',
			freezeTableName: true,
			paranoid: true,
			indexes: [
				{
					name: 'unique_type_sub_type_org_id_tenant_code',
					unique: true,
					fields: ['tenant_code', 'organization_code', 'type', 'sub_type'],
					where: { deleted_at: null },
				},
			],
		}
	)

	// Pass 'individualHooks: true' option to ensure proper triggering of 'beforeUpdate' hook.
	Form.beforeUpdate(async (form, options) => {
		form.version += 1
	})
	return Form
}

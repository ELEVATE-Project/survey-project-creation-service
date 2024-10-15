require('dotenv').config({ path: '../.env' })
const defaultOrgId = process.env.DEFAULT_ORG_ID
	? process.env.DEFAULT_ORG_ID.toString()
	: (() => {
			throw new Error('DEFAULT_ORG_ID is not defined in env')
	  })()

module.exports = {
	development: {
		url: process.env.DEV_DATABASE_URL,
		dialect: 'postgres',
		migrationStorageTableName: 'sequelize_meta',
		define: {
			underscored: true,
			freezeTableName: true,
			paranoid: true,
			syncOnAssociation: true,
			charset: 'utf8',
			collate: 'utf8_general_ci',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: 'updated_at',
			deletedAt: 'deleted_at',
		},
		defaultOrgId: defaultOrgId, // Convert to integer
	},
	test: {
		url: process.env.TEST_DATABASE_URL,
		dialect: 'postgres',
		defaultOrgId: defaultOrgId, // Convert to integer
	},
	production: {
		url: process.env.DATABASE_URL,
		dialect: 'postgres',
		defaultOrgId: defaultOrgId, // Convert to integer
	},
}

const { Sequelize } = require('sequelize')
const { matchers } = require('jest-json-schema')

// Extend Jest with JSON schema matchers
expect.extend(matchers)

// Initialize Sequelize with PostgreSQL connection details
const sequelize = new Sequelize('postgres://postgres:postgres@localhost:5432/integration_test_scp', {
	pool: {
		max: 100, // Adjust based on your test load
	},
})

// Set up the global `db` object using Sequelize instance
global.db = sequelize

beforeAll(async () => {
	try {
		// Sync all models to the database (force: true will drop tables if they exist and recreate them)
		await global.db.sync({ force: true })
		console.log('Database synced and connected')
	} catch (err) {
		console.error('Database connection error:', err)
	}
})

afterAll(async () => {
	try {
		await global.db.close() // Close the Sequelize connection pool
		console.log('Database connection closed')
	} catch (error) {
		console.error('Error during DB cleanup:', error)
	}
})

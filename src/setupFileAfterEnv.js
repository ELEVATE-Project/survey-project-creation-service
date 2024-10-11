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

// Helper function to wait and retry
const waitForDatabase = async (retries = 5, delay = 3000) => {
	for (let i = 0; i < retries; i++) {
		try {
			await global.db.authenticate()
			console.log('Connected to DB')
			return true
		} catch (err) {
			console.error(`Attempt ${i + 1} failed: ${err.message}`)
			if (i < retries - 1) {
				await new Promise((resolve) => setTimeout(resolve, delay)) // Wait before retrying
			}
		}
	}
	throw new Error('Failed to connect to the database after multiple attempts.')
}

beforeAll(async () => {
	try {
		// Retry database connection up to 5 times
		await waitForDatabase()
		// Sync all models to the database (force: true will drop tables if they exist and recreate them)
		await global.db.sync({ force: true })
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

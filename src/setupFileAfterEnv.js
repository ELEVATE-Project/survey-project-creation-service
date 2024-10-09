const { Pool } = require('pg')
const { matchers } = require('jest-json-schema')

// Extend Jest with JSON schema matchers
expect.extend(matchers)

// Create a connection pool to the PostgreSQL database
const pool = new Pool({
	connectionString: 'postgres://postgres:postgres@localhost:5432/integration_test_scp',
	max: 100, // Adjust based on your test load
})

// Set up the global `db` object using the pool
global.db = pool

beforeAll(async () => {
	try {
		// Test database connection and any setup code you need here
		await global.db.query('SELECT 1')
		console.log('Connected to DB')
	} catch (err) {
		console.error('Database connection error:', err)
	}
})

afterAll(async () => {
	try {
		await global.db.end() // Ensure the pool is properly closed
	} catch (error) {
		console.error('Error during DB cleanup:', error)
	}
})

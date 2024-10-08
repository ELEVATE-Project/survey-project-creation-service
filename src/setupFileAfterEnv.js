const { Client } = require('pg')
const { matchers } = require('jest-json-schema')

// Extend Jest with custom matchers for JSON schema validation
expect.extend(matchers)

// PostgreSQL connection string
const connectionString = 'postgres://postgres:postgres@localhost:5432/integration_test_scp'

// Declare the database client globally
let db

// Connect to the PostgreSQL database using async/await
beforeAll(async () => {
	db = new Client({
		connectionString: connectionString,
	})

	try {
		await db.connect()
		console.log('Connected to DB')
	} catch (err) {
		console.error('Database connection error:', err)
		throw err // Throw error so Jest knows something went wrong
	}
})

// Close the database connection after all tests are done
afterAll(async () => {
	try {
		// Any cleanup code goes here (like dropping tables if needed)
	} catch (error) {
		console.error('Error during cleanup:', error)
	} finally {
		if (db) {
			await db.end() // Ensure that the PostgreSQL connection is properly closed
			console.log('Database connection closed')
		}
	}
})

global.db = db

const { Client } = require('pg')
const { matchers } = require('jest-json-schema')
const { Pool } = require('pg')

expect.extend(matchers)

const connectionString = 'postgres://postgres:postgres@localhost:5432/integration_test_scp'

// Use connection pooling for better performance in tests
const pool = new Pool({
	connectionString,
	max: 10, // Max number of connections in the pool
	idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
	connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
})

// Function to ensure DB is ready
async function ensureDatabaseIsReady() {
	let retries = 5
	while (retries) {
		try {
			// Try to connect and query a simple statement
			const client = await pool.connect()
			await client.query('SELECT 1')
			client.release() // Release the client back to the pool
			console.log('Database is ready')
			break // Exit the loop if successful
		} catch (err) {
			retries -= 1
			console.log(`DB not ready yet, retries left: ${retries}`)
			await new Promise((res) => setTimeout(res, 5000)) // Wait 5 seconds before retrying
		}
		if (retries === 0) {
			throw new Error('Unable to connect to the database after several attempts')
		}
	}
}

beforeAll(async () => {
	await ensureDatabaseIsReady() // Ensure the DB is ready before running tests
})

afterAll(async () => {
	try {
		await pool.end() // Close all connections in the pool
		console.log('Database connection pool closed')
	} catch (error) {
		console.error('Error during pool shutdown', error)
	}
})

global.db = pool // Use the connection pool globally

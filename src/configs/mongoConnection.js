/**
 * name : mongoConnection.js
 * author : Adithya Dinesh
 * created-date : 09-SEPT-2025
 * Description : Handle mongo connections in a class
 * so that variour instances of the classes can be used for multiple mongo connections based on the usecase.
 */

const { MongoClient } = require('mongodb')

class MongoDBConnection {
	constructor(mongoUrl, options = { useNewUrlParser: true, useUnifiedTopology: true }) {
		if (!mongoUrl) {
			throw new Error('MONGODB_URL is required to establish a connection.')
		}
		this.mongoUrl = mongoUrl
		this.options = options
		this.client = null
		this.db = null
	}

	async connect() {
		try {
			this.client = new MongoClient(this.mongoUrl, this.options)
			await this.client.connect()
			this.db = this.client.db()
			console.log('Connected to MongoDB')
			return this.db
		} catch (error) {
			console.error('Failed to connect to MongoDB:', error.message)
			throw error
		}
	}

	async disconnect() {
		if (this.client) {
			await this.client.close()
			console.log('Disconnected from MongoDB')
			this.client = null
			this.db = null
		}
	}

	getDb() {
		if (!this.db) {
			throw new Error('No database connection. Please call connect() first.')
		}
		console.log('MongoDB Database instance retrieved')
		return this.db
	}

	async isConnected() {
		try {
			if (!this.client) return false
			await this.client.db().admin().ping()
			return true
		} catch {
			return false
		}
	}
}

module.exports = MongoDBConnection

/**
 * name : migrateProgramsAndSolutions.js
 * author : Priyanka Pradeep
 * created-date : 18-Feb-2025
 * Description : script to create the program from consumption side.
 */

require('module-alias/register')
require('dotenv').config({ path: '../../.env' })
require('../../configs/events')()
const path = require('path')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const entityTypeService = require('@services/entity-types')
const projectService = require('@services/projects')
const entityService = require('@services/entities')
const resourceService = require('@services/resource')
const resourceQueries = require('@database/queries/resources')
const _ = require('lodash')
const MongoClient = require('mongodb').MongoClient
const { v4: uuidv4 } = require('uuid')
const userRequest = require('@requests/user')
const ObjectId = require('mongodb').ObjectID

// Program migration flow
// get all the program
// get all the solutions
// find the program is exist
// find the solutions is exist
// format program
// format the solution
// if any project template is there then follow the migrate project flow
// get all project template
// Check the project exist
// fetch the task and sub task
// convert the project template
// find the entity which is not exist
// create the entity
// create the project
// make it publish
// create program resource
// create solution resource
// create rollout program
// create rollout solution
// create the certificate base template
// construct the criteria from the certificate template

const mongoUrl = process.env.MONGODB_URL

if (!mongoUrl) {
	throw new Error('MONGODB_URL is not set in the environment variables.')
}

const dbName = mongoUrl.split('/').pop()

;(async () => {
	try {
		// Connect to the MongoDB server
		const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
		const connection = await client.connect()

		console.log('Connected to MongoDB')
		const db = connection.db(dbName)
	} catch (error) {
		console.error('Error during migration:', error)
	}
})()

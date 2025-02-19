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

		// Path to the CSV file
		const outputPath = path.resolve(__dirname, 'program_migration_results.csv')

		// CSV Writer setup
		const csvWriter = createCsvWriter({
			path: outputPath,
			header: [
				{ id: 'programId', title: 'Program ID' },
				{ id: 'solutionId', title: 'Solution ID' },
				{ id: 'type', title: 'Type' },
				{ id: 'success', title: 'Success' },
				{ id: 'projectId', title: 'Project ID' },
			],
		})

		let csvRecords = []

		// Get default userId
		const DEFAULT_USER_ID = await getDefaultUserId()
		if (!DEFAULT_USER_ID) {
			throw new Error('Failed to get default org admin')
		}

		// Get all programs
		const programsData = await db
			.collection('programs')
			.find({
				status: 'active',
				scope: {
					$exists: true, // Check if the field exists
					$type: 'object', // Ensure it is an object
					$ne: {}, // Ensure it's not an empty object
				},
				components: {
					$exists: true, // Check if the field exists
					$type: 'array', // Check if it's an array
					$not: { $size: 0 }, // Ensure the array size is greater than 0
				},
			})
			.project({ _id: 1 })
			.toArray()

		console.log(`${programsData.length} programs found`)

		let chunkedPrograms = _.chunk(programsData, 10)
		for (const chunk of chunkedPrograms) {
			const programIds = chunk.map((programDoc) => programDoc._id)

			// Fetch programs sequentially
			const programs = await db
				.collection('programs')
				.find({ _id: { $in: programIds } })
				.toArray()

			// Fetch user and org details sequentially
			let userIds = programs.map((program) => program.createdBy)
			let userOrgMap = await getUserOrgDetails(userIds)

			for (const program of programs) {
				let programIdStr = program._id.toString()
				console.log(`Processing program ${programIdStr}`)

				// Check if the program exists
				const isProgramExist = await checkProgramExist(programIdStr)
				if (isProgramExist.success) {
					console.log(`Program Exist for template ${programIdStr}`)
					// csvRecords.push({
					// 	templateId: templateIdStr,
					// 	success: 'Project Exist',
					// 	projectId: isProjectExist.projectId,
					// })
					continue
				}
			}
		}

		console.log('Migration completed')
		await client.close()
		console.log('Connection closed')
	} catch (error) {
		console.error('Error during migration:', error)
	}
})()

//get default org admin
async function getDefaultUserId() {
	let defaultUserId = null
	let orgDetails = await userRequest.fetchOrg(process.env.DEFAULT_ORG_ID)
	if (
		orgDetails.success &&
		Array.isArray(orgDetails?.data?.result?.org_admin) &&
		orgDetails.data.result.org_admin.length > 0
	) {
		defaultUserId = orgDetails.data.result.org_admin[0]
	}
	return defaultUserId
}

//get user org id
async function getUserOrgDetails(userIds) {
	let userOrgMap = {}
	const users = await userRequest.list('all', '', '', '', '', {
		user_ids: userIds,
	})

	if (users.success && users.data?.result?.data?.length > 0) {
		userOrgMap = _.keyBy(users.data.result.data, 'id')
	}

	return userOrgMap
}

async function checkProgramExist(programId) {
	try {
		let program = await resourceQueries.findOne(
			{
				published_id: programId,
			},
			{
				attributes: ['id'],
			}
		)

		// Check if the project exists
		if (!program || !program.id) {
			throw new Error('Program Not Found')
		}

		return {
			success: true,
			programId: program.id,
		}
	} catch (error) {
		return {
			success: false,
			error,
		}
	}
}

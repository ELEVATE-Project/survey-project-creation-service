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
			.limit(1)
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
				// console.log(isProgramExist, 'isProgramExist')
				if (isProgramExist.success) {
					console.log(`Program Exist for template ${programIdStr}`)
					// csvRecords.push({
					// 	templateId: templateIdStr,
					// 	success: 'Project Exist',
					// 	projectId: isProjectExist.projectId,
					// })
					continue
				}

				// Convert template sequentially
				let convertedProgramTemplate = await convertProgramTemplate(program, userOrgMap, DEFAULT_USER_ID)
				if (!convertedProgramTemplate.success) {
					throw new Error(convertedProgramTemplate.error)
				}
				convertedProgramTemplate = convertedProgramTemplate.template
				// console.log(convertedProgramTemplate, 'convertedProgramTemplate')

				//convert the program components into array of object id
				const solutionObjectIds = program.components.map((stringId) => new ObjectId(stringId))

				// get all the solutions
				const solutions = await db
					.collection('solutions')
					.find({ _id: { $in: solutionObjectIds }, type: 'improvementProject' })
					.limit(1)
					.toArray()

				let solutionsFormatted = []
				for (let solution of solutions) {
					let convertedSolutionTemplate = await convertSolutionTemplate(solution, userOrgMap, DEFAULT_USER_ID)
					if (!convertedSolutionTemplate.success) {
						throw new Error(convertedSolutionTemplate.error)
					}
					solutionsFormatted.push(convertedSolutionTemplate.template)

					// if any project template is there then follow the migrate project flow
					// find the project templates
					if (solution?.projectTemplateId) {
						//find the project
						const isProjectExist = await checkProjectExist(solution.projectTemplateId.toString())
						if (isProjectExist.success) {
							console.log(`Project Exist for template ${solution.projectTemplateId.toString()}`)
						} else {
							//create template
						}
					}
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

async function convertProgramTemplate(template, userOrgMap, DEFAULT_USER_ID) {
	try {
		let userId = DEFAULT_USER_ID
		let orgId = process.env.DEFAULT_ORG_ID
		if (userOrgMap[template.createdBy]) {
			userId = template.createdBy
			orgId = userOrgMap[template.createdBy].organization.id
		}
		const convertedTemplate = {
			title: template.name,
			type: 'program',
			status: 'PUBLISHED',
			stage: 'COMPLETION',
			user_id: userId.toString(),
			published_id: template._id,
			organization_id: orgId.toString(),
			created_by: userId.toString(),
			updated_by: userId.toString(),
			published_on: new Date(),
			is_reusable: true,
			viewers: [],
			targeting_criteria: [],
			objective: template.description ? template.description : '',
			start_date: template.startDate ? template.startDate : null,
			end_date: template.endDate ? template.endDate : null,
			keywords: convertKeywords(template.keywords),
			licenses: 'cc_by_4.0',
			resources: [],
		}

		return { success: true, template: convertedTemplate }
	} catch (error) {
		console.error('Error occurred while converting the program template:', error)
		return { success: false, error }
	}
}

async function convertSolutionTemplate(template, userOrgMap, DEFAULT_USER_ID) {
	try {
		let userId = DEFAULT_USER_ID
		let orgId = process.env.DEFAULT_ORG_ID
		if (userOrgMap[template.createdBy]) {
			userId = template.createdBy
			orgId = userOrgMap[template.createdBy].organization.id
		}

		const convertedTemplate = {
			title: template.name,
			type: 'project',
			status: 'PUBLISHED',
			stage: 'COMPLETION',
			user_id: userId.toString(),
			published_id: template._id,
			organization_id: orgId.toString(),
			created_by: userId.toString(),
			updated_by: userId.toString(),
			published_on: new Date(),
			is_reusable: true,
			viewers: [],
			targeting_criteria: [],
			objective: template.description ? template.description : '',
			start_date: template.startDate ? template.startDate : null,
			end_date: template.endDate ? template.endDate : null,
			keywords: convertKeywords(template.keywords),
			licenses: 'cc_by_4.0',
		}

		return { success: true, template: convertedTemplate }
	} catch (error) {
		console.error('Error occurred while converting the solution template:', error)
		return { success: false, error }
	}
}

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

function convertKeywords(keywords) {
	if (Array.isArray(keywords) && keywords.length > 0) {
		return keywords.join(',')
	}

	return ''
}

async function checkProjectExist(templateId) {
	try {
		let project = await resourceQueries.findOne(
			{
				published_id: templateId,
				type: 'project',
			},
			{
				attributes: ['id'],
			}
		)

		// Check if the project exists
		if (!project || !project.id) {
			throw new Error('Project Not Found')
		}

		return {
			success: true,
			projectId: project.id,
		}
	} catch (error) {
		return {
			success: false,
			error,
		}
	}
}

// program template -> resource
// program template -> rollout
// solution template -> rollout
// solution template inte projectTemplate -> id find resource -> duplicate create -> add solution scope, start date, end date,
// project template -> resource

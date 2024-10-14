/**
 * name : migrateProjects.js
 * author : Priyanka Pradeep
 * created-date : 24-Aug-2024
 * Description : script to create the project from consumption side.
 */

require('module-alias/register')
require('dotenv').config({ path: '../.env' })
require('../configs/events')()
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

//get mongo db url
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
		const outputPath = path.resolve(__dirname, 'migration_results.csv')

		// CSV Writer setup
		const csvWriter = createCsvWriter({
			path: outputPath,
			header: [
				{ id: 'templateId', title: 'Template ID' },
				{ id: 'success', title: 'Success' },
				{ id: 'projectId', title: 'Project ID' },
			],
		})

		let csvRecords = []

		const entityKeys = ['categories', 'recommended_for', 'languages']
		let entityTypeEntityMap = {
			categories: { entity_type_id: null, entities: [] },
			recommended_for: { entity_type_id: null, entities: [] },
			languages: { entity_type_id: null, entities: [] },
		}

		// Get the entities for the project
		let entities = await entityTypeService.readUserEntityTypes(
			{
				value: entityKeys,
			},
			'1',
			process.env.DEFAULT_ORG_ID
		)

		let entityTypesWithEntities = entities?.result?.entity_types || []
		if (!entityTypesWithEntities.length) {
			throw new Error('Failed to fetch entities')
		}

		//create entity type and entity map
		entityTypesWithEntities.forEach((entityType) => {
			if (entityTypeEntityMap[entityType.value]) {
				entityTypeEntityMap[entityType.value].entity_type_id = entityType.id
				entityTypeEntityMap[entityType.value].entities = entityType.entities.map((entity) => entity.value)
			}
		})

		// Get all project templates
		const projectTemplates = await db
			.collection('projectTemplates')
			.find({
				status: 'published',
				isReusable: true,
			})
			.project({ _id: 1 })
			.toArray()

		console.log(`${projectTemplates.length} project templates found`)

		// Chunked processing
		let chunkedTemplates = _.chunk(projectTemplates, 10)
		let templateIds

		let createdEntityIds = {}
		let entitiesToCreate = []

		// process each templates
		for (const chunk of chunkedTemplates) {
			templateIds = chunk.map((templateDoc) => templateDoc._id)

			// Fetch templates in parallel
			const templates = await db
				.collection('projectTemplates')
				.find({ _id: { $in: templateIds } })
				.toArray()

			await Promise.all(
				templates.map(async (template) => {
					let templateIdStr = template._id.toString()
					console.log(`Processing template ${templateIdStr}`)
					// Check if the project exists before proceeding
					const isProjectExist = await checkProjectExist(templateIdStr)
					if (isProjectExist.success) {
						console.log(`Project Exist for template ${templateIdStr}`)
						csvRecords.push({
							templateId: templateIdStr,
							success: 'Project Exist',
							projectId: isProjectExist.projectId,
						})
					} else {
						let taskIdsToRemove = []
						// Check if template.tasks exist before proceeding
						if (Array.isArray(template.tasks) && template.tasks.length > 0) {
							const templateTasks = await db
								.collection('projectTemplateTasks')
								.find({ _id: { $in: template.tasks } })
								.toArray()

							if (templateTasks.length > 0) {
								template.taskDetails = templateTasks

								// Handle subtasks in parallel
								await Promise.all(
									templateTasks.map(async (currentTask) => {
										if (Array.isArray(currentTask.children) && currentTask.children.length > 0) {
											const subTasks = await db
												.collection('projectTemplateTasks')
												.find({ _id: { $in: currentTask.children } })
												.toArray()
											currentTask.children = subTasks
											taskIdsToRemove.push(...subTasks.map((task) => task._id))
										}
									})
								)

								// Remove child task from the tasks array
								if (taskIdsToRemove.length > 0) {
									template.taskDetails = template.taskDetails.filter(
										(task) => !taskIdsToRemove.some((id) => id.equals(task._id))
									)
								}
							}
						}

						// Convert template
						let convertedTemplate = await convertTemplate(template)
						if (!convertedTemplate.success) {
							throw new Error(convertedTemplate.error)
						}
						convertedTemplate = convertedTemplate.template

						// Find the non-existing entities
						for (const key of entityKeys) {
							// Check if the value is an array and remove duplicates using Set
							let values = convertedTemplate[key]
							if (Array.isArray(values) && values.length > 0) {
								values = [...new Set(values)]
								convertedTemplate[key] = formatValues(values)

								// Await async function inside the loop
								await filterNonExistingEntities(
									key,
									Array.isArray(values) ? formatValues(values) : values,
									entityTypeEntityMap,
									entitiesToCreate
								)
							}
						}

						// Create the project and entities after conversion
						let projectCreateResponse = await createProjectAndEntities(
							templateIdStr,
							convertedTemplate,
							entitiesToCreate,
							createdEntityIds
						)

						if (projectCreateResponse.success) {
							csvRecords.push({
								templateId: templateIdStr,
								success: 'Project Created',
								projectId: projectCreateResponse.projectId,
							})
						} else {
							csvRecords.push({
								templateId: templateIdStr,
								success: projectCreateResponse.error?.message
									? projectCreateResponse.error?.message
									: projectCreateResponse.error,
								projectId: null,
							})
						}
					}
				})
			)
		}

		//write data to csv
		await csvWriter.writeRecords(csvRecords)
		console.log('Migration completed')
		await client.close()
		console.log('Connection closed')
	} catch (error) {
		console.error('Error during migration:', error)
	}
})()

async function checkProjectExist(templateId) {
	try {
		let project = await resourceQueries.findOne(
			{
				organization_id: process.env.DEFAULT_ORG_ID,
				published_id: templateId,
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

async function convertTemplate(template) {
	try {
		// Helper function to convert resources
		const convertResources = (resources) =>
			resources.map(({ name, link }) => ({
				name,
				url: link,
			}))

		// Helper function to convert tasks and their children
		const convertTask = (task, index) => ({
			id: uuidv4(),
			name: task.name,
			type: task.type,
			is_mandatory: task.isDeletable ? false : true,
			allow_evidences: true,
			evidence_details: {
				file_types: task.evidenceDetails?.fileTypes || ['Images', 'Document', 'Videos', 'Audio'],
				min_no_of_evidences: task.evidenceDetails?.minNoOfEvidences || 1,
			},
			learning_resources: Array.isArray(task.learningResources) ? convertResources(task.learningResources) : [],
			sequence_no: task.sequenceNumber ? Number(task.sequenceNumber) : index + 1,
			children: task.children ? task.children.map(convertTask) : [],
		})

		const convertedTemplate = {
			title: template.title,
			objective: template.description,
			categories:
				Array.isArray(template.categories) && template.categories.length > 0
					? template.categories.map(({ name }) => name.toLowerCase())
					: [],
			recommended_duration: convertDuration(template.duration || template.metaInformation.duration),
			keywords: convertKeywords(template.keywords),
			recommended_for:
				Array.isArray(template.recommendedFor) && template.recommendedFor.length > 0
					? template.recommendedFor.map((audience) =>
							typeof audience === 'string'
								? audience.toLowerCase()
								: audience.code
								? audience.code.toLowerCase()
								: ''
					  )
					: [],
			languages: 'en',
			learning_resources: Array.isArray(template.learningResources)
				? convertResources(template.learningResources)
				: [],
			licenses: 'cc_by_4.0',
			created_by: template.createdBy,
			published_id: template._id,
			tasks: template.taskDetails ? template.taskDetails.map(convertTask) : [],
		}

		return { success: true, template: convertedTemplate }
	} catch (error) {
		console.error('Error occurred while converting the template:', error)
		return { success: false, error }
	}
}

/**
 * Converts a duration object
 * @param {Object} duration - The duration object to convert.
 * @returns {Object} - The converted duration object.
 */
function convertDuration(duration) {
	let durationString

	// Check if duration is an object with a 'value' property or a direct string
	if (typeof duration === 'object' && duration !== null && 'value' in duration) {
		durationString = duration.value
	} else if (typeof duration === 'string') {
		durationString = duration
	} else if (typeof duration === 'object' && duration !== null && 'duration' in duration) {
		durationString = duration.duration
	} else {
		// Return empty if no valid duration is provided
		return {}
	}

	const durationMatch = durationString.match(/(\d+)\s*([A-Za-z]+)/)
	const durationNumber = durationMatch ? parseInt(durationMatch[1], 10) : 0
	const durationUnit = durationMatch ? durationMatch[2].toUpperCase() : ''

	// Map units to types
	const unitMapping = {
		W: 'weeks',
		D: 'days',
		M: 'months',
		MONTH: 'months',
		MONTHS: 'months',
		WEEKS: 'weeks',
		WEEK: 'weeks',
		DAY: 'days',
		DAYS: 'days',
	}

	const durationType = unitMapping[durationUnit] || ''

	return {
		type: durationType,
		number: durationNumber,
	}
}

function convertKeywords(keywords) {
	if (Array.isArray(keywords) && keywords.length > 0) {
		return keywords.join(',')
	}

	return ''
}

//format the entity values
function formatValues(arr) {
	const formatedArray = arr.map((value) => {
		return value
			.replace(/\s*\(.*?\)\s*/g, '')
			.toLowerCase()
			.replace(/\s+/g, '_')
	})

	return formatedArray
}

//to get all entities which is not present
async function filterNonExistingEntities(entityTypeKey, values, entityTypeEntityMap, entitiesToCreate) {
	if (entityTypeEntityMap.hasOwnProperty(entityTypeKey)) {
		const entityTypeId = entityTypeEntityMap[entityTypeKey].entity_type_id
		const existingEntities = new Set(entityTypeEntityMap[entityTypeKey].entities)
		// Filter and push non-existing values in one step
		values.forEach((value) => {
			if (!existingEntities.has(value)) {
				entitiesToCreate.push({
					entity_type_id: entityTypeId,
					value: value,
				})
			}
		})
	}

	return entitiesToCreate
}

// function to create project
async function createProject(templateId, projectData, userId, orgId) {
	try {
		// Logic to create the project
		const createProject = await projectService.create(projectData, userId, orgId)
		if (!createProject?.result?.id) {
			throw new Error('Failed to create project')
		}

		const updateProject = await resourceService.publishCallback(createProject.result.id, templateId.toString())
		if (updateProject.statusCode != 202) {
			throw new Error('Failed to update project')
		}
		return { success: true, projectId: createProject.result.id }
	} catch (error) {
		console.log('Failed to create project ', projectData.published_id)
		return { success: false, error }
	}
}

// function to create project and entities
async function createProjectAndEntities(templateId, templateData, entitiesToCreate, createdEntityIds) {
	try {
		if (entitiesToCreate.length > 0) {
			for (const entity of entitiesToCreate) {
				let entityCreationData = {
					entity_type_id: entity.entity_type_id,
					value: entity.value,
					label: entity.label || entity.value,
					type: 'SYSTEM',
					status: 'ACTIVE',
					created_at: new Date(),
					updated_at: new Date(),
					created_by: 0,
					updated_by: 0,
				}

				const createdEntity = await entityService.create(entityCreationData, '0')
				if (createdEntity?.result?.id) {
					console.log(`Entity ${entity.value} created successfully.`)
					if (!createdEntityIds[entity.entity_type_id]) {
						createdEntityIds[entity.entity_type_id] = [] // Initialize if not already done
					}
					createdEntityIds[entity.entity_type_id].push(createdEntity.result.id)
				} else {
					console.error(`Failed to create entity: ${entity.value}`, createdEntity.error)
				}
			}
		}

		// Proceed to create the project after entities are processed
		const projectCreationResponse = await createProject(
			templateId,
			templateData,
			templateData.created_by,
			process.env.DEFAULT_ORG_ID
		)

		if (projectCreationResponse.success) {
			console.log('Project created successfully:', projectCreationResponse.projectId)
			return {
				success: true,
				projectId: projectCreationResponse.projectId,
			}
		} else {
			console.error('Failed to create project:', projectCreationResponse.error)
			throw new Error(projectCreationResponse.error)
		}
	} catch (error) {
		return {
			success: false,
			error,
		}
	}
}

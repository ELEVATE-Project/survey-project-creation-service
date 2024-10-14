/**
 * name : migrateProjects.js
 * author : Priyanka Pradeep
 * created-date : 24-Aug-2024
 * Description : script to create the project from consumption side.
 */

require('module-alias/register')
require('dotenv').config({ path: '../.env' })
require('../configs/events')()
const fs = require('fs')
const path = require('path')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const entityTypeService = require('@services/entity-types')
const projectService = require('@services/projects')
const entityService = require('@services/entities')
const resourceService = require('@services/resource')
const resourceQueries = require('@database/queries/resources')
const _ = require('lodash')
const MongoClient = require('mongodb').MongoClient
// var ObjectId = require('mongodb').ObjectID

//get mongo db url
const mongoUrl = process.env.MONGODB_URL

if (!mongoUrl) {
	throw new Error('MONGODB_URL is not set in the environment variables.')
}

// Path to the CSV file
const outputPath = path.resolve(__dirname, 'migration_results.csv')
console.log(outputPath, 'outputPath')

// CSV Writer setup
const csvWriter = createCsvWriter({
	path: outputPath,
	header: [
		{ id: 'templateId', title: 'Template ID' },
		{ id: 'success', title: 'Success' },
		{ id: 'projectId', title: 'Project ID' },
	],
})

const dbName = mongoUrl.split('/').pop()

;(async () => {
	try {
		// Connect to the MongoDB server
		const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
		const connection = await client.connect()

		console.log('Connected to MongoDB')
		const db = connection.db(dbName)

		let csvRecords = []
		const entityKeys = ['categories', 'recommended_for', 'languages']
		let convertedEntities = {
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

		entityTypesWithEntities.forEach((entityType) => {
			// Check if the value of entityType exists in convertedEntities
			if (convertedEntities[entityType.value]) {
				// Assign entity_type_id from the current entityType
				convertedEntities[entityType.value].entity_type_id = entityType.id

				// Map the entities to get the id and value
				convertedEntities[entityType.value].entities = entityType.entities.map((entity) => entity.value)
			}
		})

		// console.log(convertedEntities)
		// process.exit()

		// Get all project templates
		const projectTemplates = await db
			.collection('projectTemplates')
			.find({
				status: 'published',
				isReusable: true,
			})
			.project({ _id: 1 })
			.limit(1)
			.toArray()

		console.log(`${projectTemplates.length} project templates found`)

		// Chunked processing
		let chunkedTemplates = _.chunk(projectTemplates, 10)
		let templateIds

		let createdEntityIds = {}

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
						return // Skip processing if project exists
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
						entityKeys.forEach((key) => {
							const values = Array.isArray(convertedTemplate[key])
								? [...new Set(convertedTemplate[key])]
								: convertedTemplate[key]
							convertedTemplate[key] = formatValues(values)
							console.log('-=-=-=-=-=->>>', convertedTemplate)

							const entitiesToCreate = convertEntities(
								key,
								typeof values == 'array' ? formatValues(values) : values,
								convertedEntities
							)
						})

						// Find the non-existing entities
						// entityKeys.forEach((key) => {
						// 	const values = key === 'languages' ? [convertedTemplate[key]] : convertedTemplate[key]
						// 	addEntitiesToConverted(
						// 		key,
						// 		formatValues(values),
						// 		convertedEntities,
						// 		entityTypesWithEntities
						// 	)
						// 	convertedTemplate[key] = convertedEntities[key].entities
						// })

						// Create the project and entities after conversion
						// let projectCreateResponse = await createProjectAndEntities(
						// 	templateIdStr,
						// 	convertedTemplate,
						// 	convertedEntities,
						// 	createdEntityIds,
						// 	entityTypesWithEntities
						// )

						// if (projectCreateResponse.success) {
						// 	csvRecords.push({
						// 		templateId: templateIdStr,
						// 		success: 'Project Created',
						// 		projectId: projectCreateResponse.projectId,
						// 	})
						// } else {
						// 	csvRecords.push({
						// 		templateId: templateIdStr,
						// 		success: projectCreateResponse.message,
						// 		projectId: null,
						// 	})
						// }
					}
				})
			)
		}
		process.exit()

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
			id: task._id,
			name: task.name,
			type: task.type,
			is_mandatory: task.isMandatory,
			allow_evidences: task.allowEvidences,
			evidence_details: {
				file_types: task.evidenceDetails?.fileTypes || ['Images', 'Document', 'Videos', 'Audio'],
				min_no_of_evidences: task.evidenceDetails?.minNoOfEvidences || 1,
			},
			learning_resources: convertResources(task.learningResources),
			sequence_no: task.sequenceNumber ? Number(task.sequenceNumber) : index + 1,
			children: task.children ? task.children.map(convertTask) : [],
		})

		const convertedTemplate = {
			title: template.title,
			objective: template.description,
			categories: template.categories.length > 0 ? template.categories.map(({ name }) => name.toLowerCase()) : [],
			recommended_duration: convertDuration(template.duration || template.metaInformation.duration),
			keywords: convertKeywords(template.keywords),
			recommended_for:
				template.recommendedFor.length > 0
					? template.recommendedFor.map(({ audience }) => audience.toLowerCase())
					: [],
			languages: 'en',
			learning_resources: template.learningResources ? convertResources(template.learningResources) : [],
			licenses: 'cc_by_4.0',
			created_by: template.createdBy,
			published_id: template._id,
			published_on: template.createdAt,
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
		W: 'week',
		D: 'day',
		M: 'month',
		Y: 'year',
		MONTH: 'month',
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

function formatValues(arr) {
	return arr.map(({ label, value }) => ({
		label,
		value: value
			.replace(/\s*\(.*?\)\s*/g, '')
			.toLowerCase()
			.replace(/\s+/g, '_'),
	}))
}

function convertEntities(entityTypeKey, values, convertedEntities) {
	let entitiesToCreate = []

	// Check if the entityTypeKey exists in convertedEntities
	if (convertedEntities.hasOwnProperty(entityTypeKey)) {
		const entityTypeId = convertedEntities[entityTypeKey].entity_type_id

		// Create a Set of existing entity values for faster lookup
		const existingValuesSet = new Set(convertedEntities[entityTypeKey].entities.map((entity) => entity.value))

		// Filter out values that already exist and return as an array of objects
		entitiesToCreate = values
			.filter((value) => !existingValuesSet.has(value))
			.map((value) => ({
				entity_type_id: entityTypeId,
				value: value,
			}))
	}

	return entitiesToCreate
}

/*
function addEntitiesToConverted(entityTypeKey, convertedValues, convertedEntities, entityTypesWithEntities) {
	const existingEntityType = entityTypesWithEntities.find((entityType) => entityType.value === entityTypeKey)
	const existingEntities = existingEntityType ? existingEntityType.entities.map((entity) => entity.value) : []

	if (!convertedEntities[entityTypeKey]) {
		convertedEntities[entityTypeKey] = {
			entity_type_id: existingEntityType ? existingEntityType.id : null,
			entities: [],
		}
	}

	convertedValues.forEach((entity) => {
		if (existingEntities.includes(entity.value)) {
			// If the entity already exists, keep the original format
			const existingEntity = existingEntityType.entities.find((e) => e.value === entity.value)
			if (existingEntity) {
				convertedEntities[entityTypeKey].entities.push({
					label: existingEntity.label,
					value: existingEntity.value,
				})
			}
		} else {
			// If the entity doesn't exist, add it to the convertedEntities
			if (!convertedEntities[entityTypeKey].entities.some((e) => e.value === entity.value)) {
				entity.entity_type_id = existingEntityType ? existingEntityType.id : null
				convertedEntities[entityTypeKey].entities.push(entity)
			}
		}
	})
}
*/
// function to find existing entity
function findExistingEntity(entityTypeKey, entityValue, entityTypesWithEntities) {
	const entityType = entityTypesWithEntities.find((type) => type.value === entityTypeKey)

	if (!entityType) return null

	if (Array.isArray(entityType.entities)) {
		return entityType.entities.find((entity) => entity.value === entityValue) || null
	}

	return null
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

async function createProjectAndEntities(
	templateId,
	templateData,
	convertedEntities,
	createdEntityIds,
	entityTypesWithEntities
) {
	try {
		// Ensure all entity types have a valid entities array
		for (const entityTypeKey of Object.keys(convertedEntities)) {
			if (!Array.isArray(convertedEntities[entityTypeKey].entities)) {
				console.error(
					`Entities for ${entityTypeKey} is not an array:`,
					convertedEntities[entityTypeKey].entities
				)
				convertedEntities[entityTypeKey].entities = []
			}
		}

		// Process each entity type (categories, recommended_for, languages)
		for (const [entityTypeKey, entityData] of Object.entries(convertedEntities)) {
			let existingEntities = []
			let createdEntities = []
			createdEntityIds[entityTypeKey] = []

			// Ensure entities is iterable
			if (!Array.isArray(entityData.entities)) {
				console.error(`Entities for ${entityTypeKey} is not iterable.`, entityData)
				continue
			}

			for (const entity of entityData.entities) {
				const existingEntity = await findExistingEntity(entityTypeKey, entity.value, entityTypesWithEntities)

				// If the entity doesn't exist, create it
				if (!existingEntity) {
					console.log(`Entity ${entity.value} not found in ${entityTypeKey}. Creating...`)
					let entityCreationData = {
						entity_type_id: entity.entity_type_id,
						value: entity.value,
						label: entity.label,
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
						createdEntityIds[entityTypeKey].push(createdEntity.result.id)
						createdEntities.push({ label: entity.label, value: entity.value })

						// Add the new entity to entityTypesWithEntities
						const entityType = entityTypesWithEntities.find((type) => type.id === entity.entity_type_id)
						if (entityType) {
							entityType.entities.push({
								id: createdEntity.result.id,
								...entityCreationData,
							})
						}
					} else {
						console.error(`Failed to create entity: ${entity.value}`, createdEntity.error)
					}
				} else {
					console.log(`Entity ${entity.value} already exists in ${entityTypeKey}.`)
					existingEntities.push({ label: existingEntity.label, value: existingEntity.value })
				}
			}

			templateData[entityTypeKey] = [...existingEntities, ...createdEntities]
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

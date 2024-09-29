/**
 * name : migrateProjects.js
 * author : Priyanka Pradeep
 * created-date : 24-Aug-2024
 * Description : script to create the project from consumption side.
 */

require('module-alias/register')
const entityTypeService = require('@services/entity-types')
const projectService = require('@services/projects')
const entityService = require('@services/entities')
require('dotenv').config({ path: '../.env' })
const _ = require('lodash')
const MongoClient = require('mongodb').MongoClient
var ObjectId = require('mongodb').ObjectID

const mongoUrl = process.env.MONGODB_URL
const dbName = mongoUrl.split('/').pop()

;(async () => {
	try {
		// Connect to the MongoDB server
		const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
		const connection = await client.connect()

		console.log('Connected to MongoDB')
		const db = connection.db(dbName)

		let migratedTemplateIds = []
		const entityKeys = ['categories', 'recommended_for', 'languages']

		//get the entities for the project
		let entities = await entityTypeService.readUserEntityTypes(
			{
				value: entityKeys,
			},
			'1',
			process.env.DEFAULT_ORG_ID
		)

		let entityTypesWithEntities = []
		entityTypesWithEntities = entities?.result?.entity_types

		if (!entityTypesWithEntities.length) {
			throw new Error('Failed to fetch entities')
		}

		// Get all project templates
		const projectTemplates = await db
			.collection('projectTemplates')
			.find({
				status: 'published',
				isReusable: true,
				// _id: ObjectId('66399a3443d18862ed097ff1'),
			})
			.project({ _id: 1 })
			.limit(1)
			.toArray()

		console.log(`${projectTemplates.length} project templates found`)

		// Chunked processing
		let chunkedTemplates = _.chunk(projectTemplates, 10)
		let templateIds

		let convertedEntities = {
			categories: { entity_type_id: null, entities: [] },
			recommended_for: { entity_type_id: null, entities: [] },
			languages: { entity_type_id: null, entities: [] },
		}

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
					let taskIdsToRemove = []
					if (template.tasks.length > 0) {
						const templateTasks = await db
							.collection('projectTemplateTasks')
							.find({ _id: { $in: template.tasks } })
							.toArray()

						if (templateTasks.length > 0) {
							template.taskDetails = templateTasks

							// Handle subtasks in parallel
							await Promise.all(
								templateTasks.map(async (currentTask) => {
									if (currentTask.children && currentTask.children.length > 0) {
										const subTasks = await db
											.collection('projectTemplateTasks')
											.find({ _id: { $in: currentTask.children } })
											.toArray()
										currentTask.children = subTasks
										taskIdsToRemove.push(...currentTask.children.map((task) => task._id))
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

					let convertedTemplate = await convertTemplate(template)
					if (!convertedTemplate.success) {
						throw new Error(convertedTemplate.error)
					}

					convertedTemplate = convertedTemplate.template

					// find the non existing entities
					entityKeys.forEach((key) => {
						const values = key === 'languages' ? [convertedTemplate[key]] : convertedTemplate[key]
						addEntitiesToConverted(key, formatValues(values), convertedEntities, entityTypesWithEntities)
						convertedTemplate[key] = convertedEntities[key].entities
					})

					// Create the project and entities after conversion
					await createProjectAndEntities(
						convertedTemplate,
						convertedEntities,
						createdEntityIds,
						entityTypesWithEntities
					)
					migratedTemplateIds.push(template._id.toString())
				})
			)
		}

		console.log('Updated Template Count:', migratedTemplateIds.length)
		console.log('Migration completed')
		await client.close()
		console.log('Connection closed')
	} catch (error) {
		console.error('Error during migration:', error)
	}
})()

async function convertTemplate(template) {
	try {
		// Helper function to convert resources
		const convertResources = (resources) => resources.map(({ name, url }) => ({ name, url }))

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
			categories: template.categories.map(({ name }) => ({
				label: name,
				value: name.toLowerCase(),
			})),
			recommended_duration: convertDuration(template.duration || template.metaInformation.duration),
			keywords: convertKeywords(template.keywords),
			recommended_for: template.recommendedFor.map((audience) => ({
				label: audience,
				value: audience.toLowerCase(),
			})),
			languages: {
				label: 'English',
				value: 'en',
			},
			learning_resources: convertResources(template.learningResources),
			licenses: {
				label: 'CC BY 4.0',
				value: 'cc_by_4.0',
			},
			created_by: template.createdBy,
			published_id: template._id,
			published_on: template.createdAt,
			tasks: template.taskDetails.map(convertTask),
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
async function createProject(projectData, userId, orgId) {
	try {
		// Logic to create the project
		const response = await projectService.create(projectData, userId, orgId)
		return { success: true, project: response }
	} catch (error) {
		console.log('failed to create project ', projectData.published_id)
		return { success: false, error }
	}
}

async function createProjectAndEntities(templateData, convertedEntities, createdEntityIds, entityTypesWithEntities) {
	// Ensure all entity types have a valid entities array
	for (const entityTypeKey of Object.keys(convertedEntities)) {
		if (!Array.isArray(convertedEntities[entityTypeKey].entities)) {
			console.error(`Entities for ${entityTypeKey} is not an array:`, convertedEntities[entityTypeKey].entities)
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
		templateData,
		templateData.created_by,
		process.env.DEFAULT_ORG_ID
	)
	if (projectCreationResponse.success) {
		console.log('Project created successfully:', projectCreationResponse.project)
	} else {
		console.error('Failed to create project:', projectCreationResponse.error)
	}
}

/**
 * name : migrateProjects.js
 * author : Priyanka Pradeep
 * created-date : 24-Aug-2024
 * Description : Script to migrate project templates from Elevate to SCP
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

// Constants for environment variables
const { DEFAULT_TENANT_CODE, DEFAULT_ORGANIZATION_CODE, MONGODB_URL } = process.env

// Validate required environment variables
const missingVariables = [
	{ name: 'DEFAULT_TENANT_CODE', value: DEFAULT_TENANT_CODE },
	{ name: 'DEFAULT_ORGANIZATION_CODE', value: DEFAULT_ORGANIZATION_CODE },
	{ name: 'MONGODB_URL', value: MONGODB_URL },
]
	.filter(({ value }) => !value)
	.map(({ name }) => name)

if (missingVariables.length > 0) {
	throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`)
}

const dbName = MONGODB_URL.split('/').pop()

;(async () => {
	try {
		// Connect to MongoDB
		const client = new MongoClient(MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
		const connection = await client.connect()

		console.log('Connected to MongoDB')
		const db = connection.db(dbName)

		// CSV Writer setup
		const outputPath = path.resolve(__dirname, 'migration_results.csv')
		const csvWriter = createCsvWriter({
			path: outputPath,
			header: [
				{ id: 'templateId', title: 'Template ID' },
				{ id: 'success', title: 'Success' },
				{ id: 'projectId', title: 'Project ID' },
				{ id: 'tenantId', title: 'Tenant ID' },
				{ id: 'orgId', title: 'Organization ID' },
			],
			append: false, // Overwrite file at start
		})

		// Write CSV header by writing an empty array (csv-writer creates header on first write)
		await csvWriter.writeRecords([])

		const entityKeys = ['categories', 'recommended_for', 'languages']

		let entityTypeEntityMap = {}

		// Get default userId
		const DEFAULT_USER_ID = await getDefaultUserId()
		console.log('Default User ID:', DEFAULT_USER_ID)

		if (!DEFAULT_USER_ID) {
			throw new Error('Failed to get default org admin')
		}

		// Get all project templates
		const projectTemplates = await db
			.collection('projectTemplates')
			.find({
				status: 'published',
				isReusable: true,
				tenantId: { $exists: true },
				orgId: { $exists: true },
			})
			.project({ _id: 1, tenantId: 1 })
			.limit(1)
			.toArray()

		console.log(`${projectTemplates.length} project templates found`)

		// Group templates by tenant
		const groupedTemplates = _.groupBy(projectTemplates, 'tenantId')
		// Process each tenant group sequentially
		for (const tenantCode in groupedTemplates) {
			const templatesForTenant = groupedTemplates[tenantCode]

			// Chunked processing
			let chunkedTemplates = _.chunk(templatesForTenant, 10)
			let createdEntityIds = {}

			// Process each chunk sequentially
			for (const chunk of chunkedTemplates) {
				const templateIds = chunk.map((templateDoc) => templateDoc._id)

				// Fetch templates sequentially
				const templates = await db
					.collection('projectTemplates')
					.find({ _id: { $in: templateIds } })
					.toArray()

				// Fetch user and org details sequentially
				let userIds = templates
					.filter((template) => template.createdBy !== 'SYSTEM')
					.map((template) => template.createdBy)
				let userOrgTenantMap = await getUserOrgTenantDetails(userIds, tenantCode)

				for (const template of templates) {
					let templateIdStr = template._id.toString()
					console.log(`Processing template ${templateIdStr}`)

					// --- NEW: Identify tenantId and orgId for this template ---
					const { organization_code, tenant_code, user_id } = await getOrgAndTenant(
						template.createdBy,
						userOrgTenantMap,
						DEFAULT_USER_ID
					)

					const entityTypeMapKey = `${tenant_code}:::${organization_code}`

					// --- NEW: Ensure entityTypeEntityMap for this tenant/org ---
					if (!entityTypeEntityMap[entityTypeMapKey]) {
						entityTypeEntityMap[entityTypeMapKey] = {}
						// Fetch entity types for this tenant/org
						let entities = await entityTypeService.readUserEntityTypes(
							{ value: entityKeys },
							tenant_code,
							organization_code
						)

						let entityTypesWithEntities = entities?.result?.entity_types || []
						const missingEntityTypes = entityKeys.filter(
							(key) => !entityTypesWithEntities.some((et) => et.value === key)
						)

						if (missingEntityTypes.length > 0) {
							await csvWriter.writeRecords([
								{
									templateId: templateIdStr,
									success: `Error: Missing entity types: ${missingEntityTypes.join(
										', '
									)}. Please set up the tenant: ${tenant_code} and organization: ${organization_code} in SCP.`,
									projectId: null,
									tenantId: tenant_code,
									orgId: organization_code,
								},
							])
							continue // Skip to the next template
						}

						// Map entity types and their entities
						entityTypesWithEntities.forEach((entityType) => {
							entityTypeEntityMap[entityTypeMapKey][entityType.value] = {
								entity_type_id: entityType.id,
								entities: (entityType.entities || []).map((entity) => entity.value),
							}
						})
					}

					// Check if the project exists
					const isProjectExist = await checkProjectExist(templateIdStr, tenant_code, organization_code)
					if (isProjectExist.success) {
						console.log(`Project Exist for template ${templateIdStr}`)
						await csvWriter.writeRecords([
							{
								templateId: templateIdStr,
								success: 'Project Exist',
								projectId: isProjectExist.projectId,
								tenantId: tenant_code,
								orgId: organization_code,
							},
						])
						continue
					}

					let taskIdsToRemove = []
					// Check if template.tasks exist and handle sequentially
					if (Array.isArray(template.tasks) && template.tasks.length > 0) {
						const templateTasks = await db
							.collection('projectTemplateTasks')
							.find({ _id: { $in: template.tasks } })
							.toArray()

						if (templateTasks.length > 0) {
							template.taskDetails = templateTasks

							// Handle subtasks sequentially
							for (const currentTask of templateTasks) {
								if (Array.isArray(currentTask.children) && currentTask.children.length > 0) {
									const subTasks = await db
										.collection('projectTemplateTasks')
										.find({ _id: { $in: currentTask.children } })
										.toArray()

									currentTask.children = subTasks
									taskIdsToRemove.push(...subTasks.map((task) => task._id))
								}
							}

							// Remove child tasks from the tasks array
							if (taskIdsToRemove.length > 0) {
								template.taskDetails = template.taskDetails.filter(
									(task) => !taskIdsToRemove.some((id) => id.equals(task._id))
								)
							}
						}
					}

					// Convert template sequentially
					let convertedTemplate = await convertTemplate(template, user_id, organization_code, tenant_code)
					if (!convertedTemplate.success) {
						throw new Error(convertedTemplate.error)
					}
					convertedTemplate = convertedTemplate.template
					let entitiesToCreate = []
					// Find non-existing entities sequentially
					for (const key of entityKeys) {
						let values = convertedTemplate[key]
						if (Array.isArray(values) && values.length > 0) {
							values = [...new Set(values)]
							convertedTemplate[key] = formatValues(values)

							await filterNonExistingEntities(
								key,
								values,
								entityTypeEntityMap[entityTypeMapKey],
								entitiesToCreate,
								tenant_code,
								organization_code
							)
						}
					}

					// --- NEW: Pass tenant/org info to project/entities creation ---
					let projectCreateResponse = await createProjectAndEntities(
						templateIdStr,
						convertedTemplate,
						entityTypeEntityMap[entityTypeMapKey],
						entitiesToCreate,
						createdEntityIds,
						tenant_code,
						organization_code
					)

					if (projectCreateResponse.success) {
						//update scp resource id in mongo
						await db.collection('projectTemplates').updateOne(
							{
								_id: template._id,
							},
							{ $set: { scp_reference_id: projectCreateResponse.projectId } }
						)
						await csvWriter.writeRecords([
							{
								templateId: templateIdStr,
								success: 'Project Created',
								projectId: projectCreateResponse.projectId,
								tenantId: tenant_code,
								orgId: organization_code,
							},
						])
					} else {
						await csvWriter.writeRecords([
							{
								templateId: templateIdStr,
								success: projectCreateResponse.error?.message
									? projectCreateResponse.error?.message
									: projectCreateResponse.error,
								projectId: null,
								tenantId: tenant_code,
								orgId: organization_code,
							},
						])
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

//get default org admin
async function getDefaultUserId() {
	let defaultUserId = null
	let orgDetails = await userRequest.fetchOrg(DEFAULT_ORGANIZATION_CODE, DEFAULT_TENANT_CODE)
	console.log('Default Organization Details:', orgDetails)
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
async function getUserOrgTenantDetails(userIds, tenantCode) {
	let userOrgMap = {}
	const users = await userRequest.list(
		'all',
		'',
		'',
		'',
		'',
		{
			user_ids: userIds,
		},
		'',
		tenantCode
	)

	if (users.success && users.data?.result?.data?.length > 0) {
		// userOrgMap = _.keyBy(users.data.result.data, 'id')
		userOrgMap = _.keyBy(users.data.result.data, (item) => String(item.id))
	}

	return userOrgMap
}

async function checkProjectExist(templateId, tenantId, orgId) {
	try {
		let project = await resourceQueries.findOne(
			{
				published_id: templateId,
				tenant_code: tenantId,
				organization_code: orgId,
			},
			{
				attributes: ['id'],
			}
		)

		// Check if the project exists
		if (!project || !project.id) {
			// throw new Error('Project Not Found')
			return {
				success: false,
				error: 'Project Not Found',
			}
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

async function convertTemplate(template, userId, orgId, tenantId) {
	try {
		// Helper function to convert resources
		const convertResources = (resources) =>
			resources
				.filter(({ link }) => !!link)
				.map(({ name, link }) => ({
					name: name || 'Resource',
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
				file_types: task.evidenceDetails?.fileTypes || ['images', 'document', 'videos', 'audio'],
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
			languages: ['en'],
			learning_resources: Array.isArray(template.learningResources)
				? convertResources(template.learningResources)
				: [],
			licenses: 'cc_by_4.0',
			created_by: userId.toString(),
			organization_code: orgId.toString(),
			tenant_code: tenantId.toString(),
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
		duration: durationType,
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
			.trim()
			.replace(/\s+/g, '_')
	})

	return formatedArray
}

function formatEntityValue(value) {
	return value
		.replace(/\s*\(.*?\)\s*/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '_')
}

//to get all entities which is not present
async function filterNonExistingEntities(
	entityTypeKey,
	values,
	entityTypeEntityMap,
	entitiesToCreate,
	tenantId,
	orgId
) {
	if (entityTypeEntityMap.hasOwnProperty(entityTypeKey)) {
		const entityTypeId = entityTypeEntityMap[entityTypeKey].entity_type_id
		const existingEntities = new Set(entityTypeEntityMap[entityTypeKey].entities)
		// Filter and push non-existing values in one step
		values.forEach((value) => {
			// Check if the value already exists in entitiesToCreate with the same entity_type_id
			const alreadyExists = entitiesToCreate.some(
				(entity) => entity.entity_type_id == entityTypeId && entity.value == formatEntityValue(value)
			)

			// If the value is not present in existingEntities and not already in entitiesToCreate
			if (value && !existingEntities.has(formatEntityValue(value)) && !alreadyExists) {
				entitiesToCreate.push({
					entity_type_id: entityTypeId,
					value: formatEntityValue(value),
					label: formatTitle(value),
					tenant_code: tenantId,
					organization_code: orgId,
				})
			}
		})
	}

	return entitiesToCreate
}

// function to create project
async function createProject(templateId, projectData, userId, orgId, tenantId) {
	try {
		// Logic to create the project
		const createProject = await projectService.create(projectData, userId, orgId, tenantId)
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

function formatTitle(str) {
	return str
		.replace(/_/g, ' ') // Replace underscores with a space
		.trim() // Trim any leading/trailing spaces
		.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
}

// function to create project and entities
async function createProjectAndEntities(
	templateId,
	templateData,
	entityTypeEntityMap,
	entitiesToCreate,
	createdEntityIds,
	tenantId,
	orgId
) {
	try {
		if (entitiesToCreate.length > 0) {
			for (const entity of entitiesToCreate) {
				if (entity.value) {
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
						tenant_code: entity.tenant_code || tenantId,
						organization_code: entity.organization_code || orgId,
					}
					const createdEntity = await entityService.create(entityCreationData, '0')
					if (createdEntity?.result?.id) {
						console.log(`Entity ${entity.value} created successfully.`)
						//remove entity from create
						entitiesToCreate = entitiesToCreate.filter(
							(e) => !(e.entity_type_id === entity.entity_type_id && e.value === entity.value)
						)

						//add this to entityTypeEntityMap
						for (let [key, entityData] of Object.entries(entityTypeEntityMap)) {
							if (entityData.entity_type_id && entityData.entity_type_id === entity.entity_type_id) {
								entityTypeEntityMap[key].entity_type_id = entity.entity_type_id
								entityTypeEntityMap[key].entities.push(entity.value)
								break
							}
						}

						if (!createdEntityIds[entity.entity_type_id]) {
							createdEntityIds[entity.entity_type_id] = [] // Initialize if not already done
						}
						createdEntityIds[entity.entity_type_id].push(createdEntity.result.id)
					} else {
						console.error(`Failed to create entity: ${entity.value}`, createdEntity.error)
					}
				}
			}
		}

		// Proceed to create the project after entities are processed
		const projectCreationResponse = await createProject(
			templateId,
			{
				...templateData,
				tenant_code: tenantId,
				organization_code: orgId,
			},
			templateData.created_by,
			orgId,
			tenantId
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

// Get organization and tenant details for a user
async function getOrgAndTenant(userId, userOrgMap, defaultUserId) {
	// if (userOrgMap[userId] && userOrgMap[userId].organizations?.[0]?.code && userOrgMap[userId].tenant_code) {
	if (
		userOrgMap[userId] &&
		userOrgMap[userId].user_organizations?.[0]?.organization?.code &&
		userOrgMap[userId].tenant_code
	) {
		return {
			organization_code: userOrgMap[userId].user_organizations?.[0]?.organization?.code,
			tenant_code: userOrgMap[userId].tenant_code,
			user_id: userId,
		}
	} else {
		return {
			organization_code: DEFAULT_ORGANIZATION_CODE,
			tenant_code: DEFAULT_TENANT_CODE,
			user_id: defaultUserId,
		}
	}
}

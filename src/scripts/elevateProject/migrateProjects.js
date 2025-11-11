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
const MongoClient = require('mongodb').MongoClient
const { v4: uuidv4 } = require('uuid')
const _ = require('lodash')

const entityTypeService = require('@services/entity-types')
const projectService = require('@services/projects')
const entityService = require('@services/entities')
const resourceService = require('@services/resource')

const resourceQueries = require('@database/queries/resources')
const common = require('@constants/common')
const userRequest = require('@requests/user')

// Constants for environment variables
const requiredEnv = ['MONGODB_URL']
const missingVariables = requiredEnv.filter((key) => !process.env[key])

if (missingVariables.length > 0) {
	throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`)
}

const { MONGODB_URL } = process.env
const dbName = MONGODB_URL.split('/').pop()

// Configuration constants
const BATCH_SIZE = 50 // Process 50 templates at a time
const USER_CACHE_SIZE = 1000 // Cache up to 1000 users
const CURSOR_TIMEOUT = 30 * 60 * 1000 // 30 minutes cursor timeout

;(async () => {
	try {
		// Connect to MongoDB
		const client = new MongoClient(MONGODB_URL, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			maxPoolSize: 10, // Limit connection pool
			serverSelectionTimeoutMS: 5000,
			socketTimeoutMS: 45000,
		})
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
				{ id: 'creatorId', title: 'Creator ID' },
				{ id: 'assignedTo', title: 'Assigned To' },
			],
			append: false,
		})

		// Initialize CSV with header
		await csvWriter.writeRecords([])

		// Global caches with size limits
		let entityTypeEntityMap = {}
		let orgAdminCache = {}
		let userCache = new Map() // LRU-like cache for users
		let processedCount = 0
		let totalCount = 0

		// Get total count for progress tracking
		totalCount = await db.collection('projectTemplates').countDocuments({
			status: 'published',
			isReusable: true,
			//Skip projects without tenant/org details
			tenantId: { $nin: [null, ''] },
			orgId: { $nin: [null, ''] },
		})

		console.log(`Found ${totalCount} project templates to process`)

		// Create aggregation pipeline for memory-efficient processing
		const pipeline = [
			{
				$match: {
					status: 'published',
					isReusable: true,
					tenantId: { $nin: [null, ''] },
					orgId: { $nin: [null, ''] },
				},
			},
			{
				$project: {
					_id: 1,
					tenantId: 1,
					orgId: 1,
					createdBy: 1,
				},
			},
			{
				$sort: { tenantId: 1, orgId: 1 }, // Group by tenant/org for better caching
			},
		]

		// Use aggregation cursor for memory efficiency
		const cursor = db.collection('projectTemplates').aggregate(pipeline, {
			allowDiskUse: true, // Allow using disk for large datasets
			maxTimeMS: CURSOR_TIMEOUT,
			batchSize: BATCH_SIZE,
		})

		const entityKeys = ['categories', 'recommended_for', 'languages']
		let currentBatch = []
		let currentTenant = null

		// Process templates using cursor streaming
		while (await cursor.hasNext()) {
			const template = await cursor.next()

			// Group by tenant for batch processing
			if (currentTenant !== template.tenantId) {
				// Process previous batch if exists
				if (currentBatch.length > 0) {
					await processBatch(
						currentBatch,
						db,
						csvWriter,
						entityKeys,
						entityTypeEntityMap,
						orgAdminCache,
						userCache
					)
					processedCount += currentBatch.length
					console.log(
						`Progress: ${processedCount}/${totalCount} (${((processedCount / totalCount) * 100).toFixed(
							2
						)}%)`
					)
				}

				// Start new batch
				currentBatch = [template]
				currentTenant = template.tenantId
			} else {
				currentBatch.push(template)

				// Process when batch is full
				if (currentBatch.length >= BATCH_SIZE) {
					await processBatch(
						currentBatch,
						db,
						csvWriter,
						entityKeys,
						entityTypeEntityMap,
						orgAdminCache,
						userCache
					)
					processedCount += currentBatch.length
					console.log(
						`Progress: ${processedCount}/${totalCount} (${((processedCount / totalCount) * 100).toFixed(
							2
						)}%)`
					)
					currentBatch = []
				}
			}

			// Memory cleanup every 1000 records
			if (processedCount % 1000 === 0) {
				await cleanupCaches(userCache, entityTypeEntityMap)
			}
		}

		// Process remaining batch
		if (currentBatch.length > 0) {
			await processBatch(currentBatch, db, csvWriter, entityKeys, entityTypeEntityMap, orgAdminCache, userCache)
			processedCount += currentBatch.length
		}

		console.log(`Migration completed successfully. Processed ${processedCount} templates.`)
		await cursor.close()
		await client.close()
		console.log('Database connection closed')
	} catch (error) {
		console.error('Error during migration:', error)
	}
})()

// Process a batch of templates efficiently
async function processBatch(templateBatch, db, csvWriter, entityKeys, entityTypeEntityMap, orgAdminCache, userCache) {
	const tenantCode = templateBatch[0].tenantId
	console.log(`Processing batch of ${templateBatch.length} templates for tenant: ${tenantCode}`)

	// Get unique user IDs for this batch
	const userIds = [
		...new Set(templateBatch.filter((t) => t.createdBy && t.createdBy !== 'SYSTEM').map((t) => t.createdBy)),
	]

	// Batch fetch user details if not in cache
	const uncachedUserIds = userIds.filter((id) => !userCache.has(id))
	if (uncachedUserIds.length > 0) {
		const userOrgTenantMap = await getUserOrgTenantDetails(uncachedUserIds, tenantCode)

		// Update cache with size limit
		Object.entries(userOrgTenantMap).forEach(([userId, userData]) => {
			if (userCache.size >= USER_CACHE_SIZE) {
				// Remove oldest entry (simple LRU)
				const firstKey = userCache.keys().next().value
				userCache.delete(firstKey)
			}
			userCache.set(userId, userData)
		})
	}

	// Build user map from cache
	const userOrgTenantMap = {}
	userIds.forEach((id) => {
		if (userCache.has(id)) {
			userOrgTenantMap[id] = userCache.get(id)
		}
	})

	// Fetch full template details efficiently
	const templateIds = templateBatch.map((t) => t._id)
	const templates = await db
		.collection('projectTemplates')
		.find({ _id: { $in: templateIds } })
		.toArray()

	// Process each template
	for (const template of templates) {
		await processTemplate(template, db, csvWriter, entityKeys, entityTypeEntityMap, orgAdminCache, userOrgTenantMap)
	}
}

// Process individual template (extracted from main function)
async function processTemplate(
	template,
	db,
	csvWriter,
	entityKeys,
	entityTypeEntityMap,
	orgAdminCache,
	userOrgTenantMap
) {
	let templateIdStr = template._id.toString()
	console.log(`Processing template ${templateIdStr}`)

	// Validation checks
	if (!template.tenantId || !template.orgId || template.tenantId === '' || template.orgId === '') {
		console.log(`Skipping template ${templateIdStr}: Missing tenant or org details`)
		await writeSkippedRecord(csvWriter, templateIdStr, 'Missing tenant or organization details', template)
		return
	}

	// Handle missing creator in user service
	const { organization_code, tenant_code, user_id, assignedTo } = await getOrgAndTenantWithFallback(
		template.createdBy,
		userOrgTenantMap,
		template.tenantId,
		template.orgId,
		orgAdminCache
	)

	// Skip if no valid user found
	if (!user_id) {
		console.log(`Skipping template ${templateIdStr}: No valid user or org admin found`)
		await writeSkippedRecord(
			csvWriter,
			templateIdStr,
			'No valid creator or org admin found',
			template,
			tenant_code,
			organization_code
		)
		return
	}

	// EntityType handling
	const entityTypeMapKey = generateEntityTypeMapKey(tenant_code, organization_code)
	if (!entityTypeEntityMap[entityTypeMapKey]) {
		await initializeEntityTypes(entityTypeMapKey, entityTypeEntityMap, entityKeys, organization_code, tenant_code)
	}

	const currentEntityTypes = Object.keys(entityTypeEntityMap[entityTypeMapKey])
	const missingEntityTypes = entityKeys.filter((key) => !currentEntityTypes.includes(key))

	if (missingEntityTypes.length > 0) {
		console.log(`Skipping template ${templateIdStr}: Missing EntityTypes: ${missingEntityTypes.join(', ')}`)
		await writeSkippedRecord(
			csvWriter,
			templateIdStr,
			`Missing EntityTypes: ${missingEntityTypes.join(
				', '
			)}. Please set up tenant: ${tenant_code} and organization: ${organization_code} in SCP.`,
			template,
			tenant_code,
			organization_code,
			assignedTo
		)
		return
	}

	// Check if project already exists
	const isProjectExist = await checkProjectExist(templateIdStr, tenant_code, organization_code)
	if (isProjectExist.success) {
		console.log(`Project already exists for template ${templateIdStr}`)
		await writeSuccessRecord(
			csvWriter,
			templateIdStr,
			'Project Already Exists',
			isProjectExist.projectId,
			template,
			tenant_code,
			organization_code,
			assignedTo
		)
		return
	}

	// Process template tasks efficiently
	await processTemplateTasks(template, db)

	// Convert template
	let convertedTemplate = await convertTemplate(template, user_id, organization_code, tenant_code)
	if (!convertedTemplate.success) {
		console.error(`Error converting template ${templateIdStr}:`, convertedTemplate.error)
		await writeErrorRecord(
			csvWriter,
			templateIdStr,
			`Conversion Error: ${convertedTemplate.error.message || convertedTemplate.error}`,
			template,
			tenant_code,
			organization_code,
			assignedTo
		)
		return
	}

	convertedTemplate = convertedTemplate.template
	let entitiesToCreate = []

	// Find and handle missing entities
	for (const key of entityKeys) {
		let values = convertedTemplate[key]
		if (Array.isArray(values) && values.length > 0) {
			values = [...new Set(values)] // Remove duplicates
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

	// Create project and entities
	let projectCreateResponse = await createProjectAndEntities(
		templateIdStr,
		convertedTemplate,
		entityTypeEntityMap[entityTypeMapKey],
		entitiesToCreate,
		{},
		tenant_code,
		organization_code
	)

	if (projectCreateResponse.success) {
		// Update MongoDB with SCP reference ID
		await db
			.collection('projectTemplates')
			.updateOne({ _id: template._id }, { $set: { scp_reference_id: projectCreateResponse.projectId } })

		await writeSuccessRecord(
			csvWriter,
			templateIdStr,
			'Project Created Successfully',
			projectCreateResponse.projectId,
			template,
			tenant_code,
			organization_code,
			assignedTo
		)
	} else {
		await writeErrorRecord(
			csvWriter,
			templateIdStr,
			projectCreateResponse.error?.message || projectCreateResponse.error,
			template,
			tenant_code,
			organization_code,
			assignedTo
		)
	}
}

// Initialize entity types for a tenant/org combination
async function initializeEntityTypes(
	entityTypeMapKey,
	entityTypeEntityMap,
	entityKeys,
	organization_code,
	tenant_code
) {
	entityTypeEntityMap[entityTypeMapKey] = {}

	let entities = await entityTypeService.readUserEntityTypes(
		{ value: entityKeys },
		'',
		organization_code,
		tenant_code
	)

	let entityTypesWithEntities = entities?.result?.entity_types || []

	entityTypesWithEntities.forEach((entityType) => {
		entityTypeEntityMap[entityTypeMapKey][entityType.value] = {
			entity_type_id: entityType.id,
			entities: (entityType.entities || []).map((entity) => entity.value),
		}
	})
}

// Process template tasks with memory efficiency
async function processTemplateTasks(template, db) {
	if (!Array.isArray(template.tasks) || template.tasks.length === 0) {
		return
	}

	// Fetch tasks in smaller batches
	const taskBatchSize = 20
	const taskBatches = _.chunk(template.tasks, taskBatchSize)
	let allTasks = []
	let taskIdsToRemove = []

	for (const taskBatch of taskBatches) {
		const batchTasks = await db
			.collection('projectTemplateTasks')
			.find({ _id: { $in: taskBatch } })
			.toArray()

		// Process subtasks
		for (const currentTask of batchTasks) {
			if (Array.isArray(currentTask.children) && currentTask.children.length > 0) {
				const subTasks = await db
					.collection('projectTemplateTasks')
					.find({ _id: { $in: currentTask.children } })
					.toArray()

				currentTask.children = subTasks
				taskIdsToRemove.push(...subTasks.map((task) => task._id))
			}
		}

		allTasks.push(...batchTasks)
	}

	// Remove child tasks from the tasks array
	if (taskIdsToRemove.length > 0) {
		template.taskDetails = allTasks.filter((task) => !taskIdsToRemove.some((id) => id.equals(task._id)))
	} else {
		template.taskDetails = allTasks
	}
}

// Cleanup caches to prevent memory leaks
async function cleanupCaches(userCache, entityTypeEntityMap) {
	// Keep only recent user cache entries
	if (userCache.size > USER_CACHE_SIZE) {
		const keysToDelete = Array.from(userCache.keys()).slice(0, Math.floor(USER_CACHE_SIZE / 2))
		keysToDelete.forEach((key) => userCache.delete(key))
	}

	// Clean up entity type mappings for inactive tenants
	const activeKeys = Object.keys(entityTypeEntityMap)
	if (activeKeys.length > 100) {
		// Keep only recent 100 tenant/org combinations
		const keysToDelete = activeKeys.slice(0, activeKeys.length - 100)
		keysToDelete.forEach((key) => delete entityTypeEntityMap[key])
	}

	console.log(
		`Cache cleanup: User cache size: ${userCache.size}, Entity type mappings: ${
			Object.keys(entityTypeEntityMap).length
		}`
	)
}

// Helper functions for CSV writing
async function writeSkippedRecord(
	csvWriter,
	templateId,
	reason,
	template,
	tenantCode = 'N/A',
	orgCode = 'N/A',
	assignedTo = 'N/A'
) {
	await csvWriter.writeRecords([
		{
			templateId,
			success: `Skipped: ${reason}`,
			projectId: null,
			tenantId: tenantCode,
			orgId: orgCode,
			creatorId: template.createdBy || 'N/A',
			assignedTo,
		},
	])
}

async function writeSuccessRecord(
	csvWriter,
	templateId,
	message,
	projectId,
	template,
	tenantCode,
	orgCode,
	assignedTo
) {
	await csvWriter.writeRecords([
		{
			templateId,
			success: message,
			projectId,
			tenantId: tenantCode,
			orgId: orgCode,
			creatorId: template.createdBy || 'N/A',
			assignedTo,
		},
	])
}

async function writeErrorRecord(csvWriter, templateId, error, template, tenantCode, orgCode, assignedTo) {
	await csvWriter.writeRecords([
		{
			templateId,
			success: error,
			projectId: null,
			tenantId: tenantCode,
			orgId: orgCode,
			creatorId: template.createdBy || 'N/A',
			assignedTo,
		},
	])
}

// Original helper functions (unchanged but extracted for clarity)
function generateEntityTypeMapKey(tenantCode, organizationCode) {
	return `${tenantCode}:::${organizationCode}`
}

// Enhanced function to get organization and tenant details with fallback
async function getOrgAndTenantWithFallback(userId, userOrgMap, templateTenantId, templateOrgId, orgAdminCache) {
	let assignedTo = 'original_creator'

	// Debug logging
	console.log(`Processing user ${userId} for template tenant: ${templateTenantId}, org: ${templateOrgId}`)

	// Check if creator exists in user service
	if (
		userOrgMap[userId] &&
		userOrgMap[userId].user_organizations?.[0]?.organization?.code &&
		userOrgMap[userId].tenant_code
	) {
		const result = {
			organization_code: userOrgMap[userId].user_organizations[0].organization.code,
			tenant_code: userOrgMap[userId].tenant_code,
			user_id: userId,
			assignedTo: assignedTo,
		}

		return result
	}

	// Creator not found, look up org admin
	console.log(
		`Creator ${userId} not found in user service, looking up org admin for tenant: ${templateTenantId}, org: ${templateOrgId}`
	)

	// Validate template tenant and org IDs before proceeding
	if (!templateTenantId || !templateOrgId || templateTenantId === '' || templateOrgId === '') {
		console.log(`Invalid template tenant (${templateTenantId}) or org (${templateOrgId}) IDs`)
		return { organization_code: null, tenant_code: null, user_id: null, assignedTo: 'invalid_template_data' }
	}

	const orgAdminKey = `${templateTenantId}:::${templateOrgId}`

	// Check cache first
	if (orgAdminCache[orgAdminKey]) {
		if (orgAdminCache[orgAdminKey] === 'NOT_FOUND') {
			return { organization_code: null, tenant_code: null, user_id: null, assignedTo: 'not_found' }
		}
		const result = {
			organization_code: templateOrgId,
			tenant_code: templateTenantId,
			user_id: orgAdminCache[orgAdminKey],
			assignedTo: 'org_admin',
		}
		console.log(`Found cached org admin:`, result)
		return result
	}

	// Fetch org admin
	try {
		let orgDetails = await userRequest.fetchOrg(templateOrgId, templateTenantId)

		if (
			orgDetails.success &&
			Array.isArray(orgDetails?.data?.result?.org_admin) &&
			orgDetails.data.result.org_admin.length > 0
		) {
			const orgAdminId = orgDetails.data.result.org_admin[0]
			orgAdminCache[orgAdminKey] = orgAdminId

			const result = {
				organization_code: templateOrgId,
				tenant_code: templateTenantId,
				user_id: orgAdminId,
				assignedTo: 'org_admin',
			}
			console.log(`Found org admin:`, result)
			return result
		} else {
			// No org admin found
			orgAdminCache[orgAdminKey] = 'NOT_FOUND'
			console.log(`No org admin found for tenant: ${templateTenantId}, org: ${templateOrgId}`)
			return { organization_code: null, tenant_code: null, user_id: null, assignedTo: 'not_found' }
		}
	} catch (error) {
		console.error(`Error fetching org admin for tenant: ${templateTenantId}, org: ${templateOrgId}`, error)
		orgAdminCache[orgAdminKey] = 'NOT_FOUND'
		return { organization_code: null, tenant_code: null, user_id: null, assignedTo: 'error' }
	}
}

// Get user organization and tenant details
async function getUserOrgTenantDetails(userIds, tenantCode) {
	if (!userIds || userIds.length === 0) {
		return {}
	}

	try {
		const users = await userRequest.list('all', '', '', '', '', tenantCode, { user_ids: userIds }, '')

		if (users.success && users.data?.result?.data?.length > 0) {
			return _.keyBy(users.data.result.data, (item) => String(item.id))
		}
	} catch (error) {
		console.error(`Error fetching user details for tenant ${tenantCode}:`, error)
	}

	return {}
}

async function checkProjectExist(templateId, tenantId, orgId) {
	try {
		let project = await resourceQueries.findOne(
			{
				published_id: templateId,
				tenant_code: tenantId,
				organization_code: orgId,
			},
			{ attributes: ['id'] }
		)

		if (!project || !project.id) {
			return { success: false, error: 'Project Not Found' }
		}

		return { success: true, projectId: project.id }
	} catch (error) {
		console.error(`Error checking project existence for template ${templateId}:`, error)
		return { success: false, error }
	}
}

async function convertTemplate(template, userId, orgId, tenantId) {
	try {
		const convertResources = (resources) =>
			resources
				.filter(({ link }) => !!link)
				.map(({ name, link }) => ({
					name: name || 'Resource',
					url: link,
				}))

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
			recommended_duration: convertDuration(template.duration || template.metaInformation?.duration),
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
			published_id: template._id.toString(),
			tasks: template.taskDetails ? template.taskDetails.map(convertTask) : [],
		}

		return { success: true, template: convertedTemplate }
	} catch (error) {
		console.error('Error occurred while converting the template:', error)
		return { success: false, error }
	}
}

function convertDuration(duration) {
	let durationString

	if (typeof duration === 'object' && duration !== null && 'value' in duration) {
		durationString = duration.value
	} else if (typeof duration === 'string') {
		durationString = duration
	} else if (typeof duration === 'object' && duration !== null && 'duration' in duration) {
		durationString = duration.duration
	} else {
		return {}
	}

	const durationMatch = durationString.match(/(\d+)\s*([A-Za-z]+)/)
	const durationNumber = durationMatch ? parseInt(durationMatch[1], 10) : 0
	const durationUnit = durationMatch ? durationMatch[2].toUpperCase() : ''

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

	return { duration: durationType, number: durationNumber }
}

function convertKeywords(keywords) {
	if (Array.isArray(keywords) && keywords.length > 0) {
		return keywords.join(',')
	}
	return ''
}

function formatValues(arr) {
	return arr.map((value) => {
		return value
			.replace(/\s*\(.*?\)\s*/g, '')
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '_')
	})
}

function formatEntityValue(value) {
	return value
		.replace(/\s*\(.*?\)\s*/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '_')
}

// Enhanced function to filter non-existing entities
async function filterNonExistingEntities(
	entityTypeKey,
	values,
	entityTypeEntityMap,
	entitiesToCreate,
	tenantId,
	orgId
) {
	if (!entityTypeEntityMap.hasOwnProperty(entityTypeKey)) {
		console.warn(`EntityType ${entityTypeKey} not found in mapping`)
		return entitiesToCreate
	}

	const entityTypeId = entityTypeEntityMap[entityTypeKey].entity_type_id
	const existingEntities = new Set(entityTypeEntityMap[entityTypeKey].entities)

	values.forEach((value) => {
		const formattedValue = formatEntityValue(value)

		// Check if entity already exists or is already queued for creation
		const alreadyExists = entitiesToCreate.some(
			(entity) => entity.entity_type_id == entityTypeId && entity.value == formattedValue
		)

		if (value && !existingEntities.has(formattedValue) && !alreadyExists) {
			entitiesToCreate.push({
				entity_type_id: entityTypeId,
				value: formattedValue,
				label: formatTitle(value),
				tenant_code: tenantId,
				organization_code: orgId,
			})
		}
	})

	return entitiesToCreate
}

async function createProject(templateId, projectData, userId, orgId, tenantId) {
	try {
		const createProject = await projectService.create(projectData, userId, orgId, tenantId)
		if (!createProject?.result?.id) {
			throw new Error('Failed to create project - no ID returned')
		}

		// update the project status from draft to submitted before publish
		await resourceQueries.updateOne(
			{
				id: createProject.result.id,
			},
			{
				status: common.RESOURCE_STATUS_SUBMITTED,
				stage: common.RESOURCE_STAGE_REVIEW,
			}
		)

		const updateProject = await resourceService.publishCallback(createProject.result.id, templateId.toString())
		if (updateProject.statusCode != 202) {
			throw new Error(`Failed to update project - status: ${updateProject.statusCode}`)
		}

		return { success: true, projectId: createProject.result.id }
	} catch (error) {
		console.error('Failed to create project for template:', templateId, error)
		return { success: false, error }
	}
}

function formatTitle(str) {
	return str
		.replace(/_/g, ' ')
		.trim()
		.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1))
}

// Enhanced function to create project and entities
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
		// Create missing entities first
		if (entitiesToCreate.length > 0) {
			console.log(`Creating ${entitiesToCreate.length} missing entities for template ${templateId}`)

			for (const entity of entitiesToCreate) {
				if (!entity.value) continue

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

				try {
					const createdEntity = await entityService.create(
						entityCreationData,
						'0',
						entityCreationData.organization_code,
						entityCreationData.tenant_code
					)

					if (createdEntity?.result?.id) {
						console.log(`Entity ${entity.value} created successfully with ID: ${createdEntity.result.id}`)

						// Update entityTypeEntityMap
						for (let [key, entityData] of Object.entries(entityTypeEntityMap)) {
							if (entityData.entity_type_id && entityData.entity_type_id === entity.entity_type_id) {
								entityTypeEntityMap[key].entities.push(entity.value)
								break
							}
						}
					} else {
						console.error(`Failed to create entity: ${entity.value}`, createdEntity?.error)
					}
				} catch (entityError) {
					console.error(`Error creating entity ${entity.value}:`, entityError)
				}
			}
		}

		// Create the project
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
			console.log(`Project created successfully for template ${templateId}: ${projectCreationResponse.projectId}`)
			return {
				success: true,
				projectId: projectCreationResponse.projectId,
			}
		} else {
			console.error(`Failed to create project for template ${templateId}:`, projectCreationResponse.error)
			return {
				success: false,
				error: projectCreationResponse.error,
			}
		}
	} catch (error) {
		console.error(`Critical error in createProjectAndEntities for template ${templateId}:`, error)
		return {
			success: false,
			error: error.message || error,
		}
	}
}

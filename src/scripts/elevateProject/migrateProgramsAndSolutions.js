/**
 * name : migrateProgramsAndSolutions.js
 * author : Priyanka Pradeep
 * created-date : 18-Feb-2025
 * Description : Script to migrate programs and solutions with tenant support (Refactored)
 */

// Dependencies
require('module-alias/register')
require('dotenv').config({ path: '../../.env' })
require('../../configs/events')()

const path = require('path')
const fs = require('fs')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const MongoClient = require('mongodb').MongoClient
const { v4: uuidv4 } = require('uuid')
const { ObjectId } = require('mongodb')
const _ = require('lodash')
const axios = require('axios')
const { DOMParser } = require('xmldom')
const request = require('request')
const { Op } = require('sequelize')

const entityTypeService = require('@services/entity-types')
const projectService = require('@services/projects')
const resourceService = require('@services/resource')
const rolloutService = require('@services/rollouts')
const programService = require('@services/programs')
const entityService = require('@services/entities')
const fileService = require('@services/files')

const resourceQueries = require('@database/queries/resources')
const certificateBaseTemplateQueries = require('@database/queries/certificateBaseTemplate')
const programResourceMappingQueries = require('@database/queries/programResourceMapping')
const common = require('@constants/common')
const userRequest = require('@requests/user')
const endpoints = require('@constants/endpoints')

const migrationUtils = require('./utils')
const migrationConfig = require('./config')

// Constants for environment variables
const requiredEnv = [
	'MONGODB_URL',
	'CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL',
	'DEFAULT_ORG_ID',
	'CONSUMPTION_SERVICE_DOWNLOADBLE_URL',
]

// Filter out any missing environment variables
const missingVariables = requiredEnv.filter((key) => !process.env[key])

// Throw error and exit if any required variables are missing
if (missingVariables.length > 0) {
	console.log(`Missing required environment variables: ${missingVariables.join(', ')}`)
	process.exit(1)
}

const { MONGODB_URL } = process.env
const dbName = MONGODB_URL.split('/').pop()

// Configuration constants
const BATCH_SIZE = migrationConfig.BATCH_SIZE // Process 10 programs at a time
const USER_CACHE_SIZE = migrationConfig.USER_CACHE_SIZE // Cache up to 1000 users
const CURSOR_TIMEOUT = migrationConfig.CURSOR_TIMEOUT // 30 minutes cursor timeout

// Add these module-level cache variables near the top of the file, after the other constants
const entityTypeCache = new Map() // Cache for entity types by tenant and entity type name
const entityCache = new Map() // Cache for entities by query
const entityDetailsCache = new Map() // Cache for entity details by ID and tenant

;(async () => {
	try {
		// Parse command-line arguments for tenant and organization codes
		const args = process.argv.slice(2).reduce((acc, arg) => {
			const [key, value] = arg.split('=')
			if (key && value) {
				acc[key.replace(/^--/, '')] = value
			}
			return acc
		}, {})

		// Validate command-line arguments only if any are provided
		const allowedArgs = migrationConfig.ALLOWED_ARG_PROGRAM_MIGRATION_SCRIPT
		const providedArgs = Object.keys(args)

		// Only validate if arguments are provided
		if (providedArgs.length > 0) {
			// Check for invalid arguments
			const invalidArgs = providedArgs.filter((arg) => !allowedArgs.includes(arg))
			if (invalidArgs.length > 0) {
				throw new Error(
					`Invalid arguments provided: ${invalidArgs.join(
						', '
					)}. Only 'tenant_code' and 'organization_code' are allowed.`
				)
			}

			// If any arguments are provided, both must be present
			if (providedArgs.length > 0 && (!args.tenant_code || !args.organization_code)) {
				throw new Error(
					'If using command-line arguments, both tenant_code and organization_code must be provided together.'
				)
			}
		}

		let { tenant_code, organization_code } = args

		// Connect to MongoDB with optimized settings
		const client = new MongoClient(MONGODB_URL, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			// maxPoolSize: 10,
			// serverSelectionTimeoutMS: 5000,
			// socketTimeoutMS: 45000,
		})
		const connection = await client.connect()
		console.log('Connected to MongoDB')
		const db = connection.db(dbName)

		// CSV Writer setup with enhanced fields
		const outputPath = path.resolve(__dirname, 'migration_results.csv')
		const csvWriter = createCsvWriter({
			path: outputPath,
			header: [
				{ id: 'programId', title: 'Program ID' },
				{ id: 'solutionId', title: 'Solution ID' },
				{ id: 'type', title: 'Type' },
				{ id: 'success', title: 'Success' },
				{ id: 'resourceId', title: 'Resource ID' },
				{ id: 'rolloutId', title: 'Rollout ID' },
				{ id: 'tenantId', title: 'Tenant ID' },
				{ id: 'orgId', title: 'Organization ID' },
				{ id: 'creatorId', title: 'Creator ID' },
				{ id: 'assignedTo', title: 'Assigned To' },
			],
			append: false,
		})

		// Initialize CSV with header
		await csvWriter.writeRecords([])

		// Initialize caches with size limits
		let entityTypeEntityMap = {}
		let orgAdminCache = {}
		let userCache = new Map()
		let processedCount = 0
		let totalCount = 0

		// Build common filter conditions
		const baseFilter = {
			scope: { $exists: true, $type: 'object', $ne: {} },
			components: { $exists: true, $type: 'array', $not: { $size: 0 } },
			tenantId: { $nin: [null, ''] },
			orgId: { $nin: [null, ''] },
		}

		// Add filtering based on command-line arguments if provided
		const programFilter = {
			...baseFilter,
			// update filter only if args are provided
			...(tenant_code && { tenantId: tenant_code }),
			...(organization_code && { orgId: organization_code }),
		}

		// Get total count for progress tracking
		totalCount = await db.collection('programs').countDocuments(programFilter)

		console.log(`Found ${totalCount} programs to process`)

		// Create efficient aggregation pipeline
		const pipeline = [
			{
				$match: programFilter,
			},
			{
				$project: {
					_id: 1,
					tenantId: 1,
					orgId: 1,
					createdBy: 1,
					components: 1,
					scope: 1,
					startDate: 1,
					endDate: 1,
				},
			},
			{ $sort: { tenantId: 1, orgId: 1 } },
		]

		// Use cursor for memory-efficient processing
		const cursor = db.collection('programs').aggregate(pipeline, {
			allowDiskUse: true,
			maxTimeMS: CURSOR_TIMEOUT,
			batchSize: BATCH_SIZE,
		})

		const entityKeys = migrationConfig.ENTITY_TYPE_KEYS
		let currentBatch = []
		let currentTenant = null

		// Process programs using cursor streaming
		while (await cursor.hasNext()) {
			const program = await cursor.next()

			// Group by tenant for batch processing
			// Check if we've encountered a different tenant than the current batch
			if (currentTenant !== program.tenantId) {
				if (currentBatch.length > 0) {
					await processProgramBatch(
						currentBatch,
						db,
						csvWriter,
						entityKeys,
						entityTypeEntityMap,
						orgAdminCache,
						userCache
					)
					processedCount += currentBatch.length
					logProgress(processedCount, totalCount)
				}

				currentBatch = [program]
				currentTenant = program.tenantId
			} else {
				currentBatch.push(program)

				if (currentBatch.length >= BATCH_SIZE) {
					await processProgramBatch(
						currentBatch,
						db,
						csvWriter,
						entityKeys,
						entityTypeEntityMap,
						orgAdminCache,
						userCache
					)
					processedCount += currentBatch.length
					logProgress(processedCount, totalCount)
					currentBatch = []
				}
			}

			// Periodic cache cleanup
			if (processedCount % 1000 === 0) {
				await cleanupCaches(userCache, entityTypeEntityMap)
			}
		}

		// Process remaining batch
		if (currentBatch.length > 0) {
			await processProgramBatch(
				currentBatch,
				db,
				csvWriter,
				entityKeys,
				entityTypeEntityMap,
				orgAdminCache,
				userCache
			)
			processedCount += currentBatch.length
		}

		console.log(`Migration completed successfully. Processed ${processedCount} programs.`)
		await cursor.close()
		await client.close()
		console.log('Database connection closed')
	} catch (error) {
		console.error('Error during migration:', error)
		return error
	}
})()

/**
 * Processes a batch of programs for a specific tenant
 * Handles user caching, fetches program details, and processes each program individually
 * @param {Array} programBatch - Array of program objects to process
 * @param {Object} db - Database connection object
 * @param {Object} csvWriter - CSV writer instance for output
 * @param {Array} entityKeys - Array of entity key identifiers
 * @param {Map} entityTypeEntityMap - Map of entity types to entities
 * @param {Map} orgAdminCache - Cache for organization admin data
 * @param {Map} userCache - Cache for user data to avoid repeated database queries
 * @returns {Promise<void>} - Resolves when batch processing is complete
 */
async function processProgramBatch(
	programBatch,
	db,
	csvWriter,
	entityKeys,
	entityTypeEntityMap,
	orgAdminCache,
	userCache
) {
	const tenantCode = programBatch[0].tenantId
	console.log(`Processing batch of ${programBatch.length} programs for tenant: ${tenantCode}`)

	// Extract unique user IDs from programs, excluding system-created programs
	const userIds = [
		...new Set(programBatch.filter((p) => p.createdBy && p.createdBy !== 'SYSTEM').map((p) => p.createdBy)),
	]

	// Identify users not already in cache to minimize database queries
	const uncachedUserIds = userIds.filter((id) => !userCache.has(id))
	if (uncachedUserIds.length > 0) {
		// Batch fetch user details for uncached users only
		const userOrgTenantMap = await getUserOrgTenantDetails(uncachedUserIds, tenantCode)

		// Update cache with fetched user data, maintaining cache size limit
		Object.entries(userOrgTenantMap).forEach(([userId, userData]) => {
			if (userCache.size >= USER_CACHE_SIZE) {
				// Remove oldest entry if cache is at capacity
				const firstKey = userCache.keys().next().value
				userCache.delete(firstKey)
			}
			userCache.set(userId, userData)
		})
	}

	// Build user organization-tenant mapping from cache for current batch
	const userOrgTenantMap = {}
	userIds.forEach((id) => {
		if (userCache.has(id)) {
			userOrgTenantMap[id] = userCache.get(id)
		}
	})

	// Efficiently fetch complete program details for all programs in batch
	const programIds = programBatch.map((p) => p._id)
	const programs = await db
		.collection('programs')
		.find({ _id: { $in: programIds } })
		.toArray()

	// Process each program individually with all required context data
	for (const program of programs) {
		await processProgram(program, db, csvWriter, entityKeys, entityTypeEntityMap, orgAdminCache, userOrgTenantMap)
	}
}

/**
 * Processes a program by performing necessary operations using database, CSV writer,
 * and various caches and mappings.
 * @async
 * @function processProgram
 * @param {Object} program - The program object to process.
 * @param {Object} db - Database instance or connection to perform operations.
 * @param {Object} csvWriter - CSV writer instance for logging records.
 * @param {Array<string>} entityKeys - List of entity keys relevant to the program.
 * @param {Object} entityTypeEntityMap - Mapping of entity types to their entities.
 * @param {Map} orgAdminCache - Cache storing organization admin data.
 * @param {Object} userOrgTenantMap - Mapping of user IDs to their tenant and organization info.
 * @returns {Promise<void>} Resolves when the program processing is complete.
 */
async function processProgram(
	program,
	db,
	csvWriter,
	entityKeys,
	entityTypeEntityMap,
	orgAdminCache,
	userOrgTenantMap
) {
	let programIdStr = program._id.toString()
	console.log(`Processing program ${programIdStr}`)

	// Validation checks - Skip if tenantId or orgId is missing/invalid
	if (!program.tenantId || !program.orgId || program.tenantId === '' || program.orgId === '') {
		console.log(`Skipping program ${programIdStr}: Missing tenant or org details`)
		await writeSkippedRecord(
			csvWriter,
			programIdStr,
			null,
			'Missing tenant or organization details',
			null,
			null,
			program.tenantId || 'N/A',
			program.orgId || 'N/A',
			program.createdBy || 'N/A',
			'N/A'
		)
		return
	}

	// Handle missing creator in user service
	let { organization_code, tenant_code, user_id, assignedTo } = await getOrgAndTenantWithFallback(
		program.createdBy,
		userOrgTenantMap,
		program.tenantId,
		program.orgId,
		orgAdminCache
	)

	// Skip if no valid user found
	if (!user_id) {
		console.log(`Skipping program ${programIdStr}: No valid user or org admin found`)
		await writeSkippedRecord(
			csvWriter,
			programIdStr,
			null,
			'No valid creator or org admin found',
			null,
			null,
			program.tenantId || 'N/A',
			program.orgId || 'N/A',
			program.createdBy || 'N/A',
			'N/A'
		)
		return
	}

	// EntityType uniqueness - Generate unique identifier
	const entityTypeMapKey = generateEntityTypeMapKey(tenant_code, organization_code)

	// Initialize entityTypeEntityMap for this tenant/org if not already present
	if (!entityTypeEntityMap[entityTypeMapKey]) {
		// Fetch and cache entity types for this tenant/org
		let entityTypeDetails = await initializeEntityTypes(
			entityTypeMapKey,
			entityTypeEntityMap,
			entityKeys,
			organization_code,
			tenant_code
		)
		// If still not found, log and skip
		if (!entityTypeDetails || Object.keys(entityTypeDetails).length === 0) {
			await writeSkippedRecord(
				csvWriter,
				programIdStr,
				null,
				`No entityType found Please set up tenant: ${tenant_code} and organization: ${organization_code} in SCP.`,
				null,
				null,
				tenant_code,
				organization_code,
				program.createdBy || 'N/A',
				assignedTo
			)
			return
		}
	}

	const currentEntityTypes = Object.keys(entityTypeEntityMap[entityTypeMapKey])
	// Check for missing EntityTypes
	const missingEntityTypes = entityKeys.filter((key) => !currentEntityTypes.includes(key))
	// If any required EntityTypes are missing, log and skip
	if (missingEntityTypes.length > 0) {
		console.log(`Skipping program ${programIdStr}: Missing EntityTypes: ${missingEntityTypes.join(', ')}`)
		// Log the missing EntityTypes
		await writeSkippedRecord(
			csvWriter,
			programIdStr,
			null,
			`Missing EntityTypes: ${missingEntityTypes.join(
				', '
			)}. Please set up tenant: ${tenant_code} and organization: ${organization_code} in SCP.`,
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}

	// Check if the project already exists
	const isProgramExist = await checkResourceExist(programIdStr, 'program', tenant_code, organization_code)
	// If it exists, log and skip further processing
	if (isProgramExist.success) {
		console.log(`Project already exists for program ${programIdStr}`)
		await writeSuccessRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'Project Already Exists',
			isProgramExist.resourceId,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}
	// Generate targeting criteria for the program
	let programTargetingCriteriaRes = await generateTargetingCriteria(program.scope, tenant_code)
	// Validate targeting criteria generation
	if (
		!programTargetingCriteriaRes.success ||
		!Array.isArray(programTargetingCriteriaRes.result) ||
		programTargetingCriteriaRes?.result?.length === 0
	) {
		// If failed, log error and skip processing
		console.error(`Failed to generate targeting criteria for program ${programIdStr}`)
		await writeErrorRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'Failed to generate targeting criteria',
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}
	// Process each solution/component within the program
	let solutionTargetingMap = {}
	let validSolutionIds = []
	// Normalize solution IDs to ObjectId format
	const solutionMongoIds = migrationUtils.normalizeToObjectIds(program.components)
	const solutions = await db
		.collection('solutions')
		.find({
			_id: { $in: solutionMongoIds },
			type: 'improvementProject',
		})
		.toArray()
	// If no solutions found, log and skip
	if (solutions.length <= 0) {
		console.log(`No project solution found ${programIdStr}`)
		await writeErrorRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'No Solution Found',
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}
	// Process each solution individually
	for (let solution of solutions) {
		console.log(`processing solution ${solution._id}`)
		let solutionIdStr = solution._id.toString()
		// Validate presence of project template
		if (!solution?.projectTemplateId) {
			// If not found, log and skip
			console.log(`No project template found for solution id ${solutionIdStr}, `)
			await writeErrorRecord(
				csvWriter,
				programIdStr,
				solutionIdStr,
				common.ROLLOUT_TYPE_SOLUTION,
				'No project template found for solution',
				null,
				null,
				tenant_code,
				organization_code,
				program.createdBy || 'N/A',
				assignedTo
			)
			continue
		}

		// Generate targeting criteria for the solution
		let solutionTargetingCriteriaRes = await generateTargetingCriteria(solution.scope, tenant_code)
		// Validate targeting criteria generation
		if (
			!solutionTargetingCriteriaRes.success ||
			!Array.isArray(solutionTargetingCriteriaRes.result) ||
			solutionTargetingCriteriaRes?.result?.length === 0
		) {
			// If failed, log error and skip processing
			console.error(`Failed to generate targeting criteria for solution ${solutionIdStr}`)
			await writeErrorRecord(
				csvWriter,
				programIdStr,
				solutionIdStr,
				common.ROLLOUT_TYPE_SOLUTION,
				'Failed to generate targeting criteria',
				null,
				null,
				tenant_code,
				organization_code,
				program.createdBy || 'N/A',
				assignedTo
			)
			return
		}

		let projectTemplateIdStr = solution.projectTemplateId.toString()
		// Check if project resource already exists for the solution's project template
		const isProjectExist = await checkResourceExist(projectTemplateIdStr, 'project', tenant_code, organization_code)
		// If it exists, log and map for program creation
		if (isProjectExist.success) {
			console.log(`Project Resource Exist for template ${projectTemplateIdStr}`)
			validSolutionIds.push(isProjectExist.resourceId)
			solutionTargetingMap[projectTemplateIdStr] = {
				projectResourceId: isProjectExist.resourceId,
				projectId: projectTemplateIdStr,
				solutionId: solutionIdStr,
			}
		} else {
			// If not, fetch project template details
			console.log(`Project Resource Not Exist for template ${projectTemplateIdStr}`)
			const projectTemplate = await db
				.collection('projectTemplates')
				.findOne({ _id: ObjectId(projectTemplateIdStr) })

			if (!projectTemplate?._id) {
				// If not found, log and skip
				console.log(`No project template found for solution id ${solutionIdStr}, `)
				await writeErrorRecord(
					csvWriter,
					programIdStr,
					solutionIdStr,
					common.ROLLOUT_TYPE_SOLUTION,
					'No project template found',
					null,
					null,
					tenant_code,
					organization_code,
					program.createdBy || 'N/A',
					assignedTo
				)
				continue
			}
			// Validate presence of tasks in the project template
			if (!Array.isArray(projectTemplate.tasks) || projectTemplate.tasks.length === 0) {
				// If no tasks, log and skip
				console.log(`No Task Found for Project Template ${solutionIdStr}, `)
				await writeErrorRecord(
					csvWriter,
					programIdStr,
					solutionIdStr,
					common.ROLLOUT_TYPE_SOLUTION,
					'No Task Found for Project Template',
					null,
					null,
					tenant_code,
					organization_code,
					program.createdBy || 'N/A',
					assignedTo
				)
				continue
			}

			let taskIdsToRemove = []
			// Fetch all tasks associated with the project template
			const templateTasks = await db
				.collection('projectTemplateTasks')
				.find({ _id: { $in: projectTemplate.tasks } })
				.toArray()

			// If no tasks found, log and skip
			if (templateTasks.length === 0) {
				console.log(`No Task Found for Project Template ${solutionIdStr}, `)
				await writeErrorRecord(
					csvWriter,
					programIdStr,
					solutionIdStr,
					common.ROLLOUT_TYPE_SOLUTION,
					'No Task Found for Project Template',
					null,
					null,
					tenant_code,
					organization_code,
					program.createdBy || 'N/A',
					assignedTo
				)
				continue
			}

			projectTemplate.taskDetails = templateTasks
			// Identify and remove child tasks to avoid duplication
			for (const currentTask of templateTasks) {
				if (Array.isArray(currentTask.children) && currentTask.children.length > 0) {
					// Fetch child tasks
					const subTasks = await db
						.collection('projectTemplateTasks')
						.find({ _id: { $in: currentTask.children } })
						.toArray()
					currentTask.children = subTasks
					taskIdsToRemove.push(...subTasks.map((task) => task._id))
				}
			}
			// Filter out child tasks from the main task list
			if (taskIdsToRemove.length > 0) {
				projectTemplate.taskDetails = projectTemplate.taskDetails.filter(
					(task) => !taskIdsToRemove.some((id) => id.equals(task._id))
				)
			}

			// Convert project template to SCP format
			let convertedTemplate = await convertProjectTemplate(
				projectTemplate,
				user_id,
				organization_code,
				tenant_code
			)
			// Validate conversion success
			if (!convertedTemplate.success) {
				// If failed, log error and skip processing
				await writeErrorRecord(
					csvWriter,
					programIdStr,
					solutionIdStr,
					common.ROLLOUT_TYPE_SOLUTION,
					'Failed to convert the project template',
					null,
					null,
					tenant_code,
					organization_code,
					program.createdBy || 'N/A',
					assignedTo
				)
				continue
			}
			// Extract taskIdMap and template from conversion result
			let taskIdMap = convertedTemplate.taskIdMap
			convertedTemplate = convertedTemplate.template
			convertedTemplate.meta = {
				start_date: solution.startDate || null,
				end_date: solution.endDate || null,
			}
			// While copying the data, we will not include the targeting criteria, as it is specific to that particular use case. Only the program and resource details will be copied. When users create a copy from the “Browse Existing” listing, they can add the targeting criteria as needed. Including other targeting criteria would not be relevant or useful
			// convertedTemplate.targeting_criteria = solutionTargetingCriteriaRes.result || []convertedTemplate.targeting_criteria
			convertedTemplate.targeting_criteria = []
			// Ensure unique entity values and prepare for creation
			let entitiesToCreate = []
			for (const key of entityKeys) {
				let values = convertedTemplate[key]
				if (Array.isArray(values) && values.length > 0) {
					values = [...new Set(values)]
					convertedTemplate[key] = formatValues(values)
					// Check and filter non-existing entities
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
			// Handle certificate template if associated
			if (solution?.certificateTemplateId) {
				// Process certificate template
				let certificateRes = await handleCertificateTemplate(
					solution,
					projectTemplate,
					db,
					tenant_code,
					organization_code
				)
				// Validate certificate processing
				if (
					certificateRes &&
					certificateRes.success &&
					certificateRes?.scpCertificateBaseTemplate &&
					certificateRes?.certificateTemplate?.criteria &&
					certificateRes?.certificateBaseTemplate
				) {
					// Generate certificate criteria
					let certificateCeriteriaRes = await generateCertificateCriteria(
						certificateRes.certificateTemplate,
						certificateRes.certificateBaseTemplate,
						certificateRes.scpCertificateBaseTemplate,
						taskIdMap
					)
					// If successful, assign to project template
					if (certificateCeriteriaRes.success && certificateCeriteriaRes.certificate) {
						convertedTemplate.certificate = certificateCeriteriaRes.certificate
					}
				}
			}
			// Create project and associated entities in SCP
			let projectCreateResponse = await createProjectAndEntities(
				convertedTemplate,
				entityTypeEntityMap[entityTypeMapKey],
				entitiesToCreate,
				{},
				tenant_code,
				organization_code
			)
			// Validate project creation
			if (!projectCreateResponse.success) {
				// If failed, log error and skip processing
				await writeErrorRecord(
					csvWriter,
					programIdStr,
					solutionIdStr,
					common.ROLLOUT_TYPE_SOLUTION,
					'Project resource creation failed',
					null,
					null,
					tenant_code,
					organization_code,
					program.createdBy || 'N/A',
					assignedTo
				)
				continue
			}
			// Update and publish the created project resource
			const updatePayload = {
				meta: {
					start_date: solution.startDate || null,
					end_date: solution.endDate || null,
				},
				is_reusable: false,
				published_id: projectTemplate._id.toString(),
				published_on: new Date(),
				status: common.RESOURCE_STATUS_PUBLISHED,
				stage: common.RESOURCE_STAGE_COMPLETION,
			}
			//	Validate update and publish
			let updateResourceRes = await updateResource(projectCreateResponse.projectId, updatePayload)
			// If failed, log error and skip processing
			if (!updateResourceRes.success) {
				await writeErrorRecord(
					csvWriter,
					programIdStr,
					solutionIdStr,
					common.ROLLOUT_TYPE_SOLUTION,
					'Failed to update or publish resource',
					null,
					null,
					tenant_code,
					organization_code,
					program.createdBy || 'N/A',
					assignedTo
				)
				continue
			}
			// Map solution to created project resource
			await db
				.collection('solutions')
				.updateOne({ _id: solution._id }, { $set: { scp_reference_id: projectCreateResponse.projectId } })

			validSolutionIds.push(projectCreateResponse.projectId)
			// Store mapping for program creation
			solutionTargetingMap[projectTemplate._id.toString()] = {
				projectResourceId: projectCreateResponse.projectId,
				projectId: projectTemplate._id.toString(),
				solutionId: solutionIdStr,
			}
		}
	}
	// If no valid solutions were processed, log and skip program creation
	if (validSolutionIds.length === 0) {
		await writeErrorRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'No valid solution found',
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}

	// Convert program template to SCP format
	let convertedProgramTemplate = await convertProgramTemplate(program, user_id, organization_code, tenant_code)
	// Validate conversion success
	if (!convertedProgramTemplate.success) {
		console.error(`Error converting program ${programIdStr}:`, convertedProgramTemplate.error)
		await writeErrorRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			`Conversion Error: ${convertedProgramTemplate.error.message || convertedProgramTemplate.error}`,
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}
	convertedProgramTemplate = convertedProgramTemplate.template
	// Assign targeting criteria for program
	// While copying the data, we will not include the targeting criteria, as it is specific to that particular use case. Only the program and resource details will be copied. When users create a copy from the “Browse Existing” listing, they can add the targeting criteria as needed. Including other targeting criteria would not be relevant or useful
	// convertedProgramTemplate.targeting_criteria = programTargetingCriteriaRes.result || []
	convertedProgramTemplate.targeting_criteria = []
	// Assign metadata
	convertedProgramTemplate.meta = {
		start_date: program.startDate || null,
		end_date: program.endDate || null,
	}
	// Create program in SCP with associated solutions
	const programCreationResponse = await createProgram(
		programIdStr,
		convertedProgramTemplate,
		convertedProgramTemplate.created_by,
		convertedProgramTemplate.organization_code,
		convertedProgramTemplate.tenant_code,
		validSolutionIds
	)
	// Validate program creation
	if (!programCreationResponse.success || !programCreationResponse?.programId) {
		//	If failed, log error and skip further processing
		console.log(`Failed to create program ${programIdStr}: ${programCreationResponse.error}`)
		await writeErrorRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'Failed to create program',
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}

	let programResourceId = programCreationResponse.programId
	// Update original program with SCP reference ID
	await db.collection('programs').updateOne({ _id: program._id }, { $set: { scp_reference_id: programResourceId } })

	// Fetch complete program details for rollout creation
	let programDetail = await programService.details(
		programResourceId,
		convertedProgramTemplate.organization_code,
		convertedProgramTemplate.tenant_code
	)
	// Validate fetch success
	if (programDetail.statusCode !== 200 || !programDetail?.result) {
		// If failed, log error and skip further processing
		console.error(`Failed to fetch program details for ${programIdStr}`)
		await writeErrorRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'Failed to fetch the program details',
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}

	programDetail = programDetail.result

	// Format the program for rollout program creation
	let convertedProgramRolloutTemplate = _.omit(programDetail, [
		'id',
		'resources',
		'status',
		'stage',
		'next_stage',
		'review_type',
		'reference_id',
		'published_id',
		'created_at',
		'updated_at',
		'updated_by',
		'submitted_on',
		'published_on',
		'last_reviewed_on',
		'is_under_edit',
	])

	convertedProgramRolloutTemplate.resource_id = programDetail.id

	// Create program rollout
	const createProgramRolloutResponse = await rolloutService.create(
		convertedProgramRolloutTemplate,
		convertedProgramRolloutTemplate.created_by,
		convertedProgramRolloutTemplate.organization_code,
		convertedProgramRolloutTemplate.tenant_code,
		false
	)
	let programRolloutId = createProgramRolloutResponse?.result?.id
	// Validate program rollout creation
	if (createProgramRolloutResponse.statusCode == 200 && programRolloutId) {
		// If successful, log success
		await writeSuccessRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'Success',
			programDetail.id,
			programRolloutId,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
	} else {
		// If failed, log error and skip further processing
		console.log(`Failed to create program rollout ${programIdStr}`, createProgramRolloutResponse.error)
		await writeErrorRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			createProgramRolloutResponse.error,
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
	}

	// Process each solution within the program for rollout creation
	for (let solutionData of programDetail.resources) {
		// Convert solution rollout data
		let convertSolutionRolloutTemplate = _.pick(solutionData, [
			'title',
			'targeting_criteria',
			'organization_code',
			'tenant_code',
			'user_id',
			'type',
			'created_by',
		])

		// Assign additional required fields
		convertSolutionRolloutTemplate.parent_id = programRolloutId
		convertSolutionRolloutTemplate.start_date = solutionData?.meta?.start_date || null
		convertSolutionRolloutTemplate.end_date = solutionData?.meta?.end_date || null
		convertSolutionRolloutTemplate.viewers = []
		convertSolutionRolloutTemplate.resource_id = solutionData.id
		convertSolutionRolloutTemplate.template_id = solutionData.published_id

		//create the solution rollout
		const createSolutionRolloutResponse = await rolloutService.create(
			convertSolutionRolloutTemplate,
			convertSolutionRolloutTemplate.created_by,
			convertSolutionRolloutTemplate.organization_code,
			convertSolutionRolloutTemplate.tenant_code,
			true
		)

		// Validate the solution rollout creation
		if (createSolutionRolloutResponse.statusCode != 200) {
			// If failed, log error and skip to next solution
			console.log(`Failed to create solution rollout ${programIdStr}`, createSolutionRolloutResponse.error)
			await writeErrorRecord(
				csvWriter,
				programIdStr,
				solutionTargetingMap[solutionData.published_id].solutionId,
				common.ROLLOUT_TYPE_SOLUTION,
				createProgramRolloutResponse.error,
				null,
				null,
				tenant_code,
				organization_code,
				program.createdBy || 'N/A',
				assignedTo
			)
			continue
		}

		//update the solution rollout status
		await rolloutService.publishCallback(
			createSolutionRolloutResponse.result.id,
			solutionTargetingMap[solutionData.published_id].solutionId,
			solutionTargetingMap[solutionData.published_id].projectId
		)
		// Log success for the solution rollout
		await writeSuccessRecord(
			csvWriter,
			programIdStr,
			solutionTargetingMap[solutionData.published_id].solutionId,
			common.ROLLOUT_TYPE_SOLUTION,
			'Success',
			solutionData.id,
			createSolutionRolloutResponse.result.id,
			tenant_code,
			organization_code,
			convertSolutionRolloutTemplate.created_by || 'N/A',
			assignedTo
		)
	}

	//update the program rollout status
	await rolloutService.publishCallback(programRolloutId, programIdStr)
	// Log final success for the program rollout
	await writeSuccessRecord(
		csvWriter,
		programIdStr,
		'',
		common.ROLLOUT_TYPE_SOLUTION,
		'Success',
		programDetail.id,
		programRolloutId,
		tenant_code,
		organization_code,
		program.createdBy || 'N/A',
		assignedTo
	)
}

/**
 * Converts a program object into a standardized program template format
 * @param {Object} program - The source program object to convert
 * @param {string|number} user_id - ID of the user creating the template
 * @param {string|number} organization_code - Code identifying the organization
 * @param {string|number} tenant_code - Code identifying the tenant
 * @returns {Object} Returns success status and converted template or error
 */
async function convertProgramTemplate(program, user_id, organization_code, tenant_code) {
	try {
		// Create a standardized template object from the program data
		const convertedTemplate = {
			title: program.name,
			objective: program.description,
			// Process categories array, converting names to lowercase
			categories: Array.isArray(program.categories) ? program.categories.map((c) => c.name.toLowerCase()) : [],

			// Set duration from program or fallback to metaInformation
			recommended_duration: program.duration || program.metaInformation?.duration,
			keywords: program.keywords,

			// Process recommended_for array, converting to lowercase
			recommended_for: Array.isArray(program.recommendedFor)
				? program.recommendedFor.map((r) => r.toLowerCase())
				: [],
			languages: program.languages || ['en'],
			learning_resources: program.learningResources,
			licenses: 'cc_by_4.0',

			// Template metadata and identification
			created_by: user_id.toString(),
			organization_code: organization_code.toString(),
			tenant_code: tenant_code.toString(),
			type: 'program',
			published_id: program._id,

			// Set template status and stage
			status: common.RESOURCE_STATUS_PUBLISHED,
			stage: common.RESOURCE_STAGE_DRAFT,

			// Template configuration flags
			is_reusable: false,
			is_deleted: false,

			// Store program dates in meta object
			meta: { start_date: program.startDate, end_date: program.endDate },

			// Initialize empty arrays for future use
			targeting_criteria: [],
			solutions: [],
		}
		return { success: true, template: convertedTemplate }
	} catch (error) {
		return { success: false, error }
	}
}

/**
 * Converts a project template from one format to another with comprehensive task mapping
 * @param {Object} template - The original project template object to convert
 * @param {string|number} user_id - The ID of the user creating the converted template
 * @param {string|number} organization_code - The organization code associated with the template
 * @param {string|number} tenant_code - The tenant code for multi-tenancy support
 * @returns {Object} Object containing success status, converted template, and task ID mapping
 */
async function convertProjectTemplate(template, user_id, organization_code, tenant_code) {
	try {
		// Map to track original task IDs to new UUIDs for reference mapping
		const taskIdMap = {}

		/**
		 * Recursively converts a task object to the new format
		 * @param {Object} task - Original task object
		 * @param {number} index - Index position for sequence numbering
		 * @returns {Object} Converted task object with new structure
		 */
		const convertTask = (task, index) => {
			const newTaskId = uuidv4()
			taskIdMap[task._id] = newTaskId
			return {
				id: newTaskId,
				name: task.name,
				type: task.type,

				// Set mandatory status - if task is deletable, it's not mandatory
				is_mandatory: task.isDeletable ? false : true,
				allow_evidences: true,

				// Configure evidence collection settings
				evidence_details: {
					file_types: task.evidenceDetails?.fileTypes || ['images', 'document', 'videos', 'audio'],
					min_no_of_evidences: task.evidenceDetails?.minNoOfEvidences || 1,
				},

				// Convert learning resources if they exist
				learning_resources: Array.isArray(task.learningResources)
					? convertResources(task.learningResources)
					: [],
				sequence_no: task.sequenceNumber ? Number(task.sequenceNumber) : index + 1,

				// Recursively convert child tasks if they exist
				children: task.children ? task.children.map(convertTask) : [],
			}
		}

		// Build the converted template object with standardized structure
		const convertedTemplate = {
			title: template.title,
			objective: template.description,
			// Convert categories to lowercase strings, handle empty arrays
			categories:
				Array.isArray(template.categories) && template.categories.length > 0
					? template.categories.map(({ name }) => name.toLowerCase())
					: [],

			// Convert duration using helper function, with fallback to meta information
			recommended_duration: convertDuration(template.duration || template.metaInformation.duration),

			// Convert keywords using helper function
			keywords: convertKeywords(template.keywords),
			recommended_for:
				Array.isArray(template.recommendedFor) && template.recommendedFor.length > 0
					? template.recommendedFor
							.map((audience) => {
								if (typeof audience === 'string') return audience.toLowerCase()
								if (audience && audience.code) return audience.code.toLowerCase()
								return null // return null instead of ''
							})
							.filter(Boolean) // remove null or undefined
					: [],
			languages: ['en'],

			// Convert learning resources if available
			learning_resources: Array.isArray(template.learningResources)
				? convertResources(template.learningResources)
				: [],
			licenses: 'cc_by_4.0',
			created_by: user_id.toString(),
			organization_code: organization_code.toString(),
			tenant_code: tenant_code.toString(),
			type: 'project',
			published_id: template._id.toString(),
			tasks: template.taskDetails ? template.taskDetails.map(convertTask) : [],
			targeting_criteria: [],
			status: common.RESOURCE_STATUS_DRAFT,
			stage: common.RESOURCE_STAGE_CREATION,
			is_reusable: false,
			is_deleted: false,
		}
		return { success: true, template: convertedTemplate, taskIdMap: taskIdMap }
	} catch (error) {
		return { success: false, error }
	}
}

/**
 * Handles certificate template processing for project solutions
 * Creates or retrieves certificate base templates in the SCP system
 * @param {Object} solution - Solution object containing certificate template reference
 * @param {Object} projectTemplate - The project template being processed
 * @param {Object} db - Database connection object
 * @param {string} tenant_code - Tenant identifier
 * @param {string} organization_code - Organization identifier
 * @returns {Object} - Result object with certificate template data and processing status
 */
async function handleCertificateTemplate(solution, projectTemplate, db, tenant_code, organization_code) {
	try {
		// Initialize result object with default structure
		let result = {
			success: true,
			scpCertificateBaseTemplate: {},
			certificateTemplate: {},
			certificateBaseTemplate: {},
		}

		// Validate that solution has a certificate template ID
		if (!solution?.certificateTemplateId) {
			return { success: false, error: 'No certificate template ID found' }
		}

		// Fetch the certificate template from database
		const certificateTemplate = await db
			.collection('certificateTemplates')
			.findOne({ _id: ObjectId(solution.certificateTemplateId) })

		// Validate that certificate template has a base template reference
		if (!certificateTemplate?.baseTemplateId) {
			throw new Error('baseTemplateId not found in certificateTemplate')
		}

		// Fetch the certificate base template
		let certificateBaseTemplate = await db
			.collection('certificateBaseTemplates')
			.findOne({ _id: certificateTemplate.baseTemplateId })

		// Validate that base template exists
		if (!certificateBaseTemplate?._id) {
			throw new Error('certificateBaseTemplate not found')
		}

		// Check if certificate base template already exists in SCP
		const certificateTemplateInSCP = await isCertificateBaseTemplateExist(
			certificateBaseTemplate.code,
			'project',
			tenant_code,
			organization_code
		)
		let scpCertificateBaseTemplate = {}
		if (certificateTemplateInSCP.success) {
			// Use existing certificate base template from SCP
			console.log(`Certificate Base template Exist for template ${projectTemplate._id.toString()}`)
			scpCertificateBaseTemplate = certificateTemplateInSCP.certificateBaseTemplate
		} else {
			//create certificate base template in scp
			console.log('certificateBaseTemplate Not found in SCP')

			// Download SVG template from consumption service
			let templatesvgRes = await getSvgTemplate(certificateBaseTemplate)
			if (!templatesvgRes.success) {
				throw new Error('Failed to download svg template from consumption')
			}

			// Create temporary file for SVG content
			const fileName = `template_${Date.now()}.svg`
			const filePath = path.join(__dirname, fileName)
			fs.writeFileSync(filePath, templatesvgRes.svgTemplate, 'utf-8') // Save the SVG content to file

			// Prepare payload for file upload signed URL request
			const payloadData = {
				cert: {
					files: [fileName],
				},
				ref: common.CERTIFICATE,
			}

			// Get signed URL for file upload
			const getSignedUrl = await fileService.getSignedUrl(
				payloadData,
				solution?.orgId,
				solution?.tenantId,
				'BASE_TEMPLATE',
				'system',
				false
			)
			if (!getSignedUrl.result) {
				throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
			}

			// Extract upload URL and file path from signed URL response
			const fileUploadUrl = getSignedUrl.result['cert']['files'][0].url
			const uploadedFilePath = getSignedUrl.result['cert']['files'][0].file

			// Upload SVG file to cloud storage using signed URL
			const fileData = fs.readFileSync(filePath)
			await request({
				url: fileUploadUrl,
				method: 'put',
				headers: {
					'Content-Type': 'application/octet-stream', // Correct content type for SVG file uploads
				},
				body: fileData,
			})

			// Prepare certificate base template data for database storage
			const certificateData = {
				code: certificateBaseTemplate.code,
				name: certificateBaseTemplate.name,
				url: uploadedFilePath,
				organization_code: solution.orgId,
				tenant_code: solution.tenantId,
				resource_type: common.PROJECT,
				created_by: common.CREATED_BY_SYSTEM,
				created_at: new Date(),
				updated_at: new Date(),
				meta: templatesvgRes.certificateMeta, // Attach extracted meta info (logos, signatures)
			}

			// Save certificate template record in DB
			const certificateCreateRes = await certificateBaseTemplateQueries.create(certificateData)

			// Cleanup temp file
			fs.unlinkSync(filePath) // Remove temp file after upload

			scpCertificateBaseTemplate = certificateCreateRes
			console.log('Certificate Template Created Successfully:', scpCertificateBaseTemplate)
		}

		// Populate result object with all certificate template data
		result.scpCertificateBaseTemplate = scpCertificateBaseTemplate
		result.certificateTemplate = certificateTemplate
		result.certificateBaseTemplate = certificateBaseTemplate

		return result
	} catch (error) {
		console.error('Error in handleCertificateTemplate:', error)
		return { success: false, error: error.message }
	}
}

/**
 * Checks if a certificate base template exists for a given code and type.
 * @param {string} code - Certificate base template code.
 * @param {string} type - Resource type (e.g., 'project').
 * @returns {Promise<Object>} - An object with success status and certificate base template data if found.
 */
async function isCertificateBaseTemplateExist(code, type, tenant_code, organization_code) {
	try {
		let certificateBaseTemplate = await certificateBaseTemplateQueries.findOne({
			code: code,
			resource_type: type,
			tenant_code: tenant_code,
			organization_code: {
				[Op.in]: [organization_code, process.env.DEFAULT_ORG_ID || 'default_code'],
			},
		})

		// Check if the resource exists
		if (!certificateBaseTemplate || !certificateBaseTemplate.id) {
			throw new Error('certificateBaseTemplate Not Found')
		}

		return {
			success: true,
			certificateBaseTemplate: certificateBaseTemplate,
		}
	} catch (error) {
		return {
			success: false,
			error,
		}
	}
}

/**
 * Downloads and processes SVG certificate template, extracting metadata about logos and signatures
 * @param {Object} certificateBaseTemplate - Certificate base template object containing URL
 * @returns {Object} Success/error response with SVG content and extracted metadata
 */
async function getSvgTemplate(certificateBaseTemplate) {
	try {
		// Initialize result object
		let result = {
			success: true,
			svgTemplate: null,
			certificateMeta: {},
		}

		// Validate template URL exists
		let templateUrl = certificateBaseTemplate?.url
		if (!templateUrl) {
			throw new Error('Template URL not provided')
		}

		// Download SVG template from consumption service
		const svgTemplateRes = await generateDownloadableUrlInConsumption(
			process.env.INTERFACE_SERVICE_HOST +
				process.env.CONSUMPTION_SERVICE_BASE_URL +
				process.env.CONSUMPTION_SERVICE_DOWNLOADBLE_URL +
				'?file=' +
				templateUrl
		)

		// Validate download was successful
		if (!svgTemplateRes.success || !svgTemplateRes?.file) {
			throw new Error('svg Template Not Found')
		}

		result.svgTemplate = svgTemplateRes.file

		// Parse SVG content using DOM parser
		const parser = new DOMParser()
		const svgDoc = parser.parseFromString(svgTemplateRes.file, 'image/svg+xml')

		// Get all image elements for logo and signature detection
		const logoImages = svgDoc.getElementsByTagName('image')
		const signatureImages = svgDoc.getElementsByTagName('image')

		// Initialize metadata objects
		const logos = {}
		const signatures = {}
		const signatureTitles = {}

		let logoCount = 0
		let signatureCount = 0

		// Identify and count logo images by ID or class name
		for (let i = 0; i < logoImages.length; i++) {
			const id = logoImages[i].getAttribute('id') || ''
			const className = logoImages[i].getAttribute('class') || ''
			if (id.toLowerCase().includes('logo') || className.toLowerCase().includes('logo')) {
				logoCount++
				logos[id] = null
			}
		}

		// Identify and count signature images by ID or class name
		for (let i = 0; i < signatureImages.length; i++) {
			const id = signatureImages[i].getAttribute('id') || ''
			const className = signatureImages[i].getAttribute('class') || ''
			if (id.toLowerCase().includes('signature') || className.toLowerCase().includes('signature')) {
				signatureCount++
				// Create signature metadata with default titles
				signatures[`signatureImg${signatureCount}`] = null
				signatureTitles[`signatureTitleName${signatureCount}`] = 'Name'
				signatureTitles[`signatureTitleDesignation${signatureCount}`] = 'Designation'
			}
		}

		// Add counts to respective objects
		logos['no_of_logos'] = logoCount
		signatures['no_of_signature'] = signatureCount

		// Build complete certificate metadata
		result.certificateMeta = {
			logos,
			signature: signatures,
			...signatureTitles,
		}

		return result
	} catch (error) {
		console.error('Error in cerificate meta creation:', error)
		return {
			success: false,
			error,
		}
	}
}

/**
 * Downloads a file from a given URL and returns its content.
 * @param {string} url - The URL to download the file from.
 * @returns {Promise<Object>} - An object with success status and file data.
 */
async function generateDownloadableUrlInConsumption(url) {
	try {
		// Download the file
		const response = await axios.get(url, { timeout: 6000 })
		let result = { success: true, file: null }

		if (response.status === 200) {
			const file = response?.data
			result.file = file
		} else {
			console.error('Unexpected response status:', response.status)
		}

		return result
	} catch (error) {
		console.error('Error generating consumption presigned URL:', error.message)
		return {
			success: false,
			error,
		}
	}
}

/**
 * Generates certificate criteria with transformed task IDs and structured metadata.
 * @param {Object} certificateTemplate - Certificate template containing issuer and criteria.
 * @param {Object} certificateBaseTemplate - Base template metadata (logos, signatures).
 * @param {Object} scpCertificateBaseTemplate - SCP's certificate base template details.
 * @param {Object} taskIdMap - Mapping of MongoDB task IDs to UUIDs.
 * @returns {Promise<Object>} - An object containing success status and formatted certificate data.
 */
async function generateCertificateCriteria(
	certificateTemplate,
	certificateBaseTemplate,
	scpCertificateBaseTemplate,
	taskIdMap
) {
	try {
		let certificate = {}

		// Check if mandatory fields are present
		if (!certificateTemplate?.criteria || !certificateTemplate?.issuer) {
			return {
				success: true,
				result: certificate,
			}
		}

		// Initialize certificate structure
		certificate = {
			base_template_id: scpCertificateBaseTemplate?.id || null,
			base_template_url: {
				filePath: scpCertificateBaseTemplate?.url || '',
			},
			code: scpCertificateBaseTemplate?.code || '',
			name: scpCertificateBaseTemplate?.name || '',
			issuer: certificateTemplate?.issuer?.name || '',
			criteria: {},
			logos: {
				stateLogo1: certificateBaseTemplate?.logos?.stateLogo1 || '',
				no_of_logos: certificateBaseTemplate?.logos?.no_of_logos || 0,
			},
			signature: {
				signatureImg1: certificateBaseTemplate?.signature?.signatureImg1 || '',
				signatureTitleName1: certificateBaseTemplate?.signature?.signatureTitleName1 || '',
				signatureTitleDesignation1: certificateBaseTemplate?.signature?.signatureTitleDesignation1 || '',
				no_of_signature: certificateBaseTemplate?.signature?.no_of_signature || 0,
			},
		}

		let originalCriteria = certificateTemplate.criteria
		let transformedConditions = {}

		// Step 1: Loop through each condition
		for (let [key, condition] of Object.entries(originalCriteria.conditions)) {
			let innerConditionKey = Object.keys(condition.conditions)[0]
			let innerCondition = condition.conditions[innerConditionKey]

			let isTask = innerCondition.scope === 'task'
			let mongoTaskId = innerCondition.taskDetails?.[0] // Original Mongo ID

			let taskUUID = isTask && mongoTaskId && taskIdMap[mongoTaskId] ? taskIdMap[mongoTaskId] : null

			// Prepare transformed condition object
			let transformedCondition = {
				validationText: Array.isArray(condition.validationText)
					? condition.validationText[0]
					: condition.validationText,
				expression: condition.expression, // Keep expression untouched ("C1", "C2", etc.)
				conditions: {},
			}

			// Prepare inner condition details
			let newInnerCondition = {
				scope: innerCondition.scope,
				key: innerCondition.key,
				operator: innerCondition.operator,
				value:
					typeof innerCondition.value === 'number' ? innerCondition.value.toString() : innerCondition.value,
			}

			// Add function and filter if present
			if (innerCondition.function) {
				newInnerCondition.function = innerCondition.function
			}

			if (innerCondition.filter) {
				newInnerCondition.filter = innerCondition.filter
			}

			// Replace taskDetails Mongo ID with UUID if possible
			if (isTask && taskUUID) {
				newInnerCondition.taskDetails = [taskUUID]
			} else if (isTask && mongoTaskId) {
				// If mapping not found, keep original Mongo ID
				newInnerCondition.taskDetails = [mongoTaskId]
			}

			// Add final inner condition under its original key (C1, C2, etc.)
			transformedCondition.conditions[innerConditionKey] = newInnerCondition

			// Add to transformed conditions set
			transformedConditions[key] = transformedCondition
		}

		// Step 2: Replace task IDs in global/top-level expression
		let transformedExpression = originalCriteria.expression
		for (const mongoId in taskIdMap) {
			const uuid = taskIdMap[mongoId]
			transformedExpression = transformedExpression.replace(new RegExp(`\\b${mongoId}\\b`, 'g'), uuid)
		}

		// Step 3: Prepare final criteria object
		certificate.criteria = {
			validationText: Array.isArray(originalCriteria.validationText)
				? originalCriteria.validationText[0]
				: originalCriteria.validationText,
			expression: transformedExpression,
			conditions: transformedConditions,
		}

		return {
			success: true,
			certificate: certificate,
		}
	} catch (error) {
		console.error('Error in generateCertificateCriteria:', error)
		return {
			success: false,
			error,
		}
	}
}

/**
 * Creates entities and a project based on a converted template
 * @name createProjectAndEntities
 * @param {Object} convertedTemplate - The project template data to create
 * @param {Object} entityTypeEntityMap - Map of entity types to their entities
 * @param {Array} entitiesToCreate - Array of entities that need to be created
 * @param {Object} createdEntityIds - Object to store IDs of created entities by type
 * @param {string} tenant_code - Tenant identifier code
 * @param {string} organization_code - Organization identifier code
 * @param {Array} [solutions=[]] - Optional array of solutions to associate with the project
 * @returns {Promise<Object>} Returns success status and projectId or error details
 */
async function createProjectAndEntities(
	convertedTemplate,
	entityTypeEntityMap,
	entitiesToCreate,
	createdEntityIds,
	tenant_code,
	organization_code,
	solutions = []
) {
	try {
		// Process and create entities if any are provided
		if (entitiesToCreate.length > 0) {
			for (const entity of entitiesToCreate) {
				if (entity.value) {
					// Prepare entity creation payload
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
					const createdEntity = await entityService.create(
						entityCreationData,
						'0',
						organization_code,
						tenant_code
					)
					if (createdEntity?.result?.id) {
						console.log(`Entity ${entity.value} created successfully.`)
						// Remove the created entity from the entities to create list
						entitiesToCreate = entitiesToCreate.filter(
							(entity) =>
								!(entity.entity_type_id === entity.entity_type_id && entity.value === entity.value)
						)

						// Update the entity type mapping with the new entity
						for (let [key, entityData] of Object.entries(entityTypeEntityMap)) {
							if (entityData.entity_type_id && entityData.entity_type_id === entity.entity_type_id) {
								entityTypeEntityMap[key].entity_type_id = entity.entity_type_id
								entityTypeEntityMap[key].entities.push(entity.value)
								break
							}
						}

						// Track created entity IDs by type
						if (!createdEntityIds[entity.entity_type_id]) {
							createdEntityIds[entity.entity_type_id] = [] // Initialize if not already done
						}
						// Add the new entity ID to the list for this entity type
						createdEntityIds[entity.entity_type_id].push(createdEntity.result.id)
					} else {
						console.error(`Failed to create entity: ${entity.value}`, createdEntity.error)
					}
				}
			}
		}

		// Create the project with the converted template and associated solutions
		const project = await projectService.create(
			{ ...convertedTemplate, solutions, is_reusable: false },
			convertedTemplate.created_by,
			organization_code,
			tenant_code
		)
		// Validate project creation response
		if (project.statusCode != 200) {
			return { success: false, error: project.error }
		}
		// Return success with the new project ID
		return { success: true, projectId: project.result.id }
	} catch (error) {
		return { success: false, error }
	}
}

/**
 * Updates a resource by ID and returns the updated resource
 * @param {string|number} resourceId - The ID of the resource to update
 * @param {Object} payload - The data to update the resource with
 * @returns {Promise<{success: boolean, updatedResource?: Object, error?: Error}>} Result object with success status and updated resource or error
 */
async function updateResource(resourceId, payload) {
	try {
		// Initialize result object
		let result = {
			success: true,
			updatedResource: null,
		}

		// Define options to return the updated resource
		const updateOptions = {
			returning: true,
			raw: true,
		}

		// Perform the update operation
		const updatedResource = await resourceQueries.updateOne({ id: resourceId }, payload, updateOptions)
		result.updatedResource = updatedResource
		return result
	} catch (error) {
		return { success: false, error }
	}
}

/**
 * Checks if a resource exists based on published ID, type, tenant code, and organization code
 * @param {string|number} publishedId - The published ID of the resource
 * @param {string} type - The type of the resource
 * @param {string} tenant_code - The tenant code
 * @param {string} organization_code - The organization code
 * @returns {Promise<{success: boolean, resourceId?: string|number, error?: Error}>} Result object with success status and resource ID or error
 */
async function checkResourceExist(publishedId, type, tenant_code, organization_code) {
	try {
		// Check if the resource exists
		let resource = await resourceQueries.findOne(
			{ published_id: publishedId, type: type, tenant_code, organization_code },
			{ attributes: ['id'] }
		)
		// If resource does not exist, throw an error
		if (!resource || !resource.id) {
			throw new Error('Resource Not Found')
		}
		// Return success with the resource ID
		return { success: true, resourceId: resource.id }
	} catch (error) {
		return { success: false, error }
	}
}

/**
 * Creates a program and maps associated resources to it
 * @name createProgram
 * @param {String} programId - The published ID of the program template
 * @param {Object} programData - The program data to be created
 * @param {String} userId - User ID who is creating the program
 * @param {String} orgId - Organization ID under which the program is created
 * @param {Array} solutionIds - List of solution/resource IDs to be mapped to the program
 * @returns {Object} Result object containing success status and the created program ID or error
 */
async function createProgram(programId, programData, userId, orgId, tenantCode, solutionIds) {
	try {
		// Logic to create the program
		const createProgramRes = await programService.create(programData, userId, orgId, tenantCode)
		if (!createProgramRes?.result?.id) {
			throw new Error('Failed to create program')
		}

		// update the program status from draft to submitted before publish
		await resourceQueries.updateOne(
			{
				id: createProgramRes.result.id,
			},
			{
				status: common.RESOURCE_STATUS_SUBMITTED,
				stage: common.RESOURCE_STAGE_REVIEW,
			}
		)

		//add resource to program
		for (let solutionId of solutionIds) {
			await programResourceMappingQueries.create({
				program_id: createProgramRes.result.id,
				resource_id: solutionId,
				organization_code: orgId,
				tenant_code: tenantCode,
			})
		}

		//publish the program
		const updateProgram = await resourceService.publishCallback(createProgramRes.result.id, programId.toString())
		if (updateProgram.statusCode != 202) {
			throw new Error('Failed to update program')
		}
		// Return success with the created program ID
		return { success: true, programId: createProgramRes.result.id }
	} catch (error) {
		console.log('Failed to create program ', programId)
		return { success: false, error }
	}
}

/**
 * Gets organization and tenant information with fallback logic
 * @param {string} createdBy - User ID who created the resource
 * @param {Object} userOrgTenantMap - Map of user IDs to their org/tenant info
 * @param {string} programTenantId - Default program tenant ID
 * @param {string} programOrgId - Default program organization ID
 * @param {Object} orgAdminCache - Cache for organization admin IDs
 * @returns {Promise<Object>} Object containing organization_code, tenant_code, user_id, and assignedTo
 */
async function getOrgAndTenantWithFallback(createdBy, userOrgTenantMap, programTenantId, programOrgId, orgAdminCache) {
	// Default to program's org and tenant
	let organization_code = programOrgId
	let tenant_code = programTenantId
	let user_id = userOrgTenantMap[createdBy]?.user_id || null

	// Override with user's org and tenant if available
	if (user_id && userOrgTenantMap[user_id]) {
		organization_code = userOrgTenantMap[createdBy]?.user_organizations?.[0]?.organization_code || programOrgId
		tenant_code = userOrgTenantMap[createdBy]?.tenant_code || programTenantId
	}
	// If no user ID or system user, fallback to org admin
	if (!user_id || user_id === 'SYSTEM') {
		const cacheKey = `${organization_code}:${tenant_code}`
		// Check cache first
		if (!orgAdminCache[cacheKey]) {
			const orgAdminId = await getDefaultOrgAdmin(tenant_code, organization_code)
			// If no org admin found, log warning and assign to SYSTEM
			if (!orgAdminId) {
				console.warn(`No default org admin found for org: ${organization_code}, tenant: ${tenant_code}`)
				return { organization_code, tenant_code, user_id: null, assignedTo: 'SYSTEM' }
			}
			// Cache the org admin ID for future lookups
			orgAdminCache[cacheKey] = orgAdminId
		}
		// Assign org admin as the user
		user_id = orgAdminCache[cacheKey]
		return { organization_code, tenant_code, user_id, assignedTo: 'SYSTEM_ADMIN' }
	}

	return { organization_code, tenant_code, user_id, assignedTo: user_id }
}

/**
 * Retrieves the default organization admin for a given tenant and organization
 * @param {string} tenantId - The tenant identifier
 * @param {string} orgId - The organization identifier
 * @returns {Promise<string|null>} The default org admin ID or null if not found
 */
async function getDefaultOrgAdmin(tenantId, orgId) {
	// Fetch user details using the user request service
	let users = await userRequest.list(common.ORG_ADMIN_ROLE, '', '', '', orgId, tenantId, {})
	users = users?.data?.result?.data || []
	let orgAdmin = users?.[0]?.id || null
	if (!orgAdmin && orgId !== process.env.DEFAULT_ORGANIZATION_CODE) {
		let users = await userRequest.list(
			common.ORG_ADMIN_ROLE,
			'',
			'',
			'',
			process.env.DEFAULT_ORGANIZATION_CODE,
			tenantId,
			{}
		)
		users = users?.data?.result?.data || []
		orgAdmin = users?.[0]?.id || null
	}
	// Return a keyed object of users if found, otherwise return an empty object
	return orgAdmin
}

/**
 * Initializes entity types mapping for a given organization and tenant
 * @async
 * @function initializeEntityTypes
 * @param {string} entityTypeMapKey - Key for the entity type map
 * @param {Object} entityTypeEntityMap - Map to store entity type data
 * @param {Array<string>} entityKeys - Array of entity keys to fetch
 * @param {string} organization_code - Organization code
 * @param {string} tenant_code - Tenant code
 * @returns {Promise<Object>} Updated entity type entity map
 */
async function initializeEntityTypes(
	entityTypeMapKey,
	entityTypeEntityMap,
	entityKeys,
	organization_code,
	tenant_code
) {
	try {
		// Fetch entity types and their entities
		const entityTypes = await entityTypeService.readUserEntityTypes(
			{ value: entityKeys },
			'',
			organization_code,
			tenant_code
		)
		// Validate response
		if (entityTypes.statusCode != 200 || !entityTypes?.result?.entity_types?.length) {
			throw new Error(`Failed to fetch entities for tenant: ${tenant_code}, org: ${organization_code}`)
		}
		// Map entity types to their entities
		entityTypeEntityMap[entityTypeMapKey] = {}
		// Loop through each entity type and populate the map
		entityTypes.result.entity_types.forEach((entityType) => {
			// Only include entity types that are in the provided keys
			if (entityKeys.includes(entityType.value)) {
				// Initialize entity type entry if not already present
				entityTypeEntityMap[entityTypeMapKey][entityType.value] = {
					entity_type_id: entityType.id,
					entities: entityType.entities.map((entity) => entity.value),
				}
			}
		})
		return entityTypeEntityMap
	} catch (error) {
		console.error(`Error initializing entity types for ${entityTypeMapKey}:`, error)
		return (entityTypeEntityMap[entityTypeMapKey] = {})
	}
}

/**
 * Filters out values that already exist in the given entity type map
 * and prepares new entities to be created.
 * @async
 * @function filterNonExistingEntities
 * @param {string} key - The key representing the entity type in the entityTypeMap.
 * @param {string[]} values - List of entity values to check against existing entities.
 * @param {Object} entityTypeMap - A map of entity types containing `entities` and `entity_type_id`.
 * @param {Array<Object>} entitiesToCreate - Reference array where new entity objects will be pushed.
 * @param {string} tenant_code - Code identifying the tenant.
 * @param {string} organization_code - Code identifying the organization.
 * @returns {Promise<void>} Resolves when filtering and insertion are complete.
 */
async function filterNonExistingEntities(key, values, entityTypeMap, entitiesToCreate, tenant_code, organization_code) {
	// Create a set of existing entities for quick lookup
	const existingEntities = new Set(entityTypeMap[key]?.entities || [])
	// Filter out values that already exist
	const nonExisting = values.filter((v) => !existingEntities.has(v))
	// If there are non-existing values, prepare them for creation
	if (nonExisting.length > 0) {
		entitiesToCreate.push({
			entity_type_id: entityTypeMap[key].entity_type_id,
			entities: nonExisting.map((value) => ({ value, label: value, created_by: null })),
			tenant_code,
			organization_code,
		})
	}
}

/**
 * Fetches user details for the given user IDs within a specific tenant.
 * @async
 * @function getUserOrgTenantDetails
 * @param {string[]} userIds - Array of user IDs to fetch details for.
 * @param {string} tenantCode - Code identifying the tenant.
 * @returns {Promise<Object>} A promise that resolves to an object keyed by user ID containing user details. Returns an empty object if no users are found.
 */
async function getUserOrgTenantDetails(userIds, tenantCode) {
	// Fetch user details using the user request service
	const users = await userRequest.list('all', '', '', '', '', tenantCode, { user_ids: userIds })
	// Return a keyed object of users if found, otherwise return an empty object
	return users.success && users.data?.result?.data?.length > 0 ? _.keyBy(users.data.result.data, 'id') : {}
}

/**
 * Fetches entity types by query from the interface service with individual caching
 * @async
 * @function fetchEntityTypesByQuery
 * @param {string[]} entityTypeNames - Array of entity type names to search for
 * @param {string} tenantId - The tenant ID to filter entity types by
 * @returns {Promise<Array<Object>>} Promise that resolves to an array of entity type objects
 */
async function fetchEntityTypesByQuery(entityTypeNames, tenantId) {
	try {
		// Track which entity types we need to fetch from API
		const typesToFetch = []
		const cachedResults = []

		// Check cache for each entity type individually
		for (const typeName of entityTypeNames) {
			const cacheKey = `${tenantId}:${typeName}`

			if (entityTypeCache.has(cacheKey)) {
				// Found in cache
				cachedResults.push(entityTypeCache.get(cacheKey))
			} else {
				// Not in cache, need to fetch
				typesToFetch.push(typeName)
			}
		}

		// If all entity types were in cache, return combined results
		if (typesToFetch.length === 0) {
			console.log(`Using cached entity types for all types: [${entityTypeNames.join(', ')}]`)
			return cachedResults
		}

		// Otherwise, fetch missing entity types from API
		console.log(`Fetching entity types from API: [${typesToFetch.join(', ')}]`)

		// Construct the API URL using environment variables and endpoint
		const apiUrl = `${process.env.INTERFACE_SERVICE_HOST}${process.env.CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL}${endpoints.ENTITY_TYPES_FIND_BY_QUERY}`

		// Prepare the request payload with query and projection
		const payload = {
			query: {
				name: {
					$in: typesToFetch,
				},
				tenantId: tenantId,
			},
			projection: ['_id', 'isObservable', 'name', 'tenantId'],
		}

		// Make the POST request to fetch entity types
		const response = await axios.post(apiUrl, payload, {
			headers: {
				'content-type': 'application/json',
				'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
			},
		})

		// Process API response
		const apiResults = []
		if (response.status === 200 && response.data && Array.isArray(response.data.result)) {
			// Cache each entity type individually
			response.data.result.forEach((entityType) => {
				if (entityType && entityType.name) {
					const cacheKey = `${tenantId}:${entityType.name}`
					entityTypeCache.set(cacheKey, entityType)
					apiResults.push(entityType)
				}
			})
		}

		// Clean cache if it gets too large
		if (entityTypeCache.size > 500) {
			const keysToDelete = Array.from(entityTypeCache.keys()).slice(0, 100)
			keysToDelete.forEach((key) => entityTypeCache.delete(key))
			console.log(`Cleaned entity type cache, removed ${keysToDelete.length} entries`)
		}

		// Combine cached and newly fetched results
		return [...cachedResults, ...apiResults]
	} catch (error) {
		console.error('Error fetching entityTypes:', error)
		return []
	}
}

/**
 * Fetches entities by query from the entity management service with caching
 * @param {Object} filter - MongoDB-style query filter object
 * @param {string[]|Object} projection - Array of field names or projection object to include in results
 * @param {string} tenantId - The tenant ID
 * @param {string} entityType - Entity type name for logging purposes
 * @returns {Promise<Array>} Array of entity objects or empty array on error
 */
async function fetchEntitiesByQuery(filter, projection, tenantId, entityType) {
	try {
		// For entity queries, we need to cache based on the exact filter
		const filterKey = JSON.stringify(filter)
		const projectionKey = JSON.stringify(projection)
		const cacheKey = `${tenantId}:${entityType}:${filterKey}:${projectionKey}`

		// Check cache for this exact query
		if (entityCache.has(cacheKey)) {
			console.log(`Using cached entities for ${entityType}`)
			return entityCache.get(cacheKey)
		}

		// Not in cache, need to fetch from API
		console.log(`Fetching entities from API for ${entityType}`)

		// Construct the API URL
		const apiUrl = `${process.env.INTERFACE_SERVICE_HOST}${process.env.CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL}${endpoints.FIND_ENTITIES_BY_QUERY}`

		// Prepare the request payload
		const payload = {
			query: filter,
			projection: projection,
		}

		// Make the API request
		const response = await axios.post(apiUrl, payload, {
			headers: {
				'content-type': 'application/json',
				'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
			},
		})

		// Handle the response
		if (response.status === 200 && response.data && Array.isArray(response.data.result)) {
			const result = response.data.result || []

			// Store in cache
			entityCache.set(cacheKey, result)

			// Clean up cache if too large
			if (entityCache.size > 1000) {
				const keysToDelete = Array.from(entityCache.keys()).slice(0, 200)
				keysToDelete.forEach((key) => entityCache.delete(key))
				console.log(`Cleaned entity cache, removed ${keysToDelete.length} entries`)
			}

			return result
		} else {
			console.error(`Failed to fetch ${entityType}:`, response.status)
			return []
		}
	} catch (error) {
		console.error(`Error fetching ${entityType}:`, error)
		return []
	}
}

/**
 * Fetches detailed information for a specific entity with caching
 * @param {string} entityId - The unique identifier of the entity
 * @param {string} tenantId - The tenant identifier
 * @returns {Promise<Object|null>} Promise that resolves to entity details object or null on error
 */
async function fetchEntityDetails(entityId, tenantId) {
	try {
		// Create a cache key using entity ID and tenant
		const cacheKey = `${tenantId}:${entityId}`

		// Check cache
		if (entityDetailsCache.has(cacheKey)) {
			console.log(`Using cached details for entity ${entityId}`)
			return entityDetailsCache.get(cacheKey)
		}

		// Not in cache, fetch from API
		console.log(`Fetching entity details for ${entityId}`)

		// Construct API URL
		const apiUrl = `${process.env.INTERFACE_SERVICE_HOST}${process.env.CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL}v1/entities/details/${entityId}`

		// Make API request
		const response = await axios.get(apiUrl, {
			headers: {
				'content-type': 'application/json',
				tenantId: tenantId,
			},
		})

		// Process response
		if (response.status === 200 && response.data) {
			const result = response.data

			// Store in cache
			entityDetailsCache.set(cacheKey, result)

			// Clean cache if too large
			if (entityDetailsCache.size > 2000) {
				const keysToDelete = Array.from(entityDetailsCache.keys()).slice(0, 400)
				keysToDelete.forEach((key) => entityDetailsCache.delete(key))
				console.log(`Cleaned entity details cache, removed ${keysToDelete.length} entries`)
			}

			return result
		} else {
			console.error(`Failed to fetch entity details for ${entityId}:`, response.status)
			return null
		}
	} catch (error) {
		console.error(`Error fetching entity details for ${entityId}:`, error)
		return null
	}
}

/**
 * Generates a unique key for an entity type map by combining tenant and organization codes.
 * @function generateEntityTypeMapKey
 * @param {string} tenant_code - Code identifying the tenant.
 * @param {string} organization_code - Code identifying the organization.
 * @returns {string} A concatenated key in the format `${tenant_code}:${organization_code}`.
 */
function generateEntityTypeMapKey(tenant_code, organization_code) {
	return `${tenant_code}:${organization_code}`
}

/**
 * Formats an array of strings by removing parentheses content, converting to lowercase,
 * trimming spaces, and replacing spaces with underscores.
 * @function formatValues
 * @param {string[]} arr - Array of strings to format.
 * @returns {string[]} A new array of formatted strings.
 */
function formatValues(arr) {
	return arr.map((value) => {
		return value
			.replace(/\s*\(.*?\)\s*/g, '')
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '_')
	})
}

/**
 * Converts a duration input into a standardized object with a numeric value and unit.
 * @function convertDuration
 * @param {string|Object} duration - The duration to convert. Can be a string like "5 days"
 *                                   or an object containing `value` or `duration` properties.
 * @returns {Object} An object with the shape `{ duration: string, number: number }`.
 *                   `duration` is normalized to 'days', 'weeks', or 'months'.
 *                   Returns an empty object `{}` if input is invalid or cannot be parsed.
 * @example
 * convertDuration("5 days") // { duration: "days", number: 5 }
 * convertDuration({ value: "2 weeks" }) // { duration: "weeks", number: 2 }
 */
function convertDuration(duration) {
	let durationString
	// Determine the type of input and extract the duration string
	if (typeof duration === 'object' && duration !== null && 'value' in duration) {
		durationString = duration.value
	} else if (typeof duration === 'string') {
		durationString = duration
	} else if (typeof duration === 'object' && duration !== null && 'duration' in duration) {
		durationString = duration.duration
	} else {
		return {}
	}
	// Use regex to extract numeric value and unit from the duration string
	const durationMatch = durationString.match(/(\d+)\s*([A-Za-z]+)/)
	const durationNumber = durationMatch ? parseInt(durationMatch[1], 10) : 0
	const durationUnit = durationMatch ? durationMatch[2].toUpperCase() : ''
	// Map various unit representations to standardized units
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
	// Get the standardized duration unit or default to an empty string if not recognized
	const durationType = unitMapping[durationUnit] || ''
	// Return empty object if parsing failed or unit is unrecognized
	return { duration: durationType, number: durationNumber }
}

/**
 * Converts an array of keywords into a comma-separated string.
 * @function convertKeywords
 * @param {string[]} keywords - An array of keyword strings.
 * @returns {string} A single string of comma-separated keywords. Returns an empty string if the input array is empty or not an array.
 */
function convertKeywords(keywords) {
	if (Array.isArray(keywords) && keywords.length > 0) {
		return keywords.join(',')
	}
	return ''
}

/**
 * Converts an array of resource objects by filtering out those without links
 * and mapping them to a standardized format.
 * @function convertResources
 * @param {Array<{ name?: string, link?: string }>} resources - Array of resource objects.
 * @returns {Array<{ name: string, url: string }>} A new array of resources with `name` and `url` properties.
 */
function convertResources(resources) {
	return resources
		.filter(({ link }) => !!link)
		.map(({ name, link }) => ({
			name: name || 'Resource',
			url: link,
		}))
}

/**
 * Logs the progress of a process as a percentage.
 * @function logProgress
 * @param {number} processed - The number of items processed so far.
 * @param {number} total - The total number of items to process.
 * @returns {void} Does not return a value; logs progress to the console.
 */
function logProgress(processed, total) {
	const percentage = ((processed / total) * 100).toFixed(2)
	console.log(`Processing progress: ${processed}/${total} (${percentage}%)`)
}

/**
 * Writes a skipped record to a CSV file with details about the program and reason for skipping.
 * @async
 * @function writeSkippedRecord
 * @param {Object} csvWriter - CSV writer instance with a `writeRecords` method.
 * @param {string} programId - ID of the program.
 * @param {string} solutionId - ID of the solution.
 * @param {string} reason - Reason why the record was skipped.
 * @param {string} resourceId - ID of the associated resource.
 * @param {string} rolloutId - ID of the rollout.
 * @param {string} [tenantCode='N/A'] - Tenant code, default is 'N/A'.
 * @param {string} [orgCode='N/A'] - Organization code, default is 'N/A'.
 * @param {string} [creatorId='N/A'] - ID of the creator, default is 'N/A'.
 * @param {string} [assignedTo='N/A'] - ID of the assigned user, default is 'N/A'.
 * @returns {Promise<void>} Resolves when the skipped record has been written to the CSV.
 */
async function writeSkippedRecord(
	csvWriter,
	programId,
	solutionId,
	reason,
	resourceId,
	rolloutId,
	tenantCode = 'N/A',
	orgCode = 'N/A',
	creatorId = 'N/A',
	assignedTo = 'N/A'
) {
	await csvWriter.writeRecords([
		{
			programId,
			solutionId,
			type: 'PROGRAM',
			success: `Skipped: ${reason}`,
			resourceId,
			rolloutId,
			tenantId: tenantCode,
			orgId: orgCode,
			creatorId,
			assignedTo,
		},
	])
}

/**
 * Writes a successful record to a CSV file with details about the program and message.
 * @async
 * @function writeSuccessRecord
 * @param {Object} csvWriter - CSV writer instance with a `writeRecords` method.
 * @param {string} programId - ID of the program.
 * @param {string} solutionId - ID of the solution.
 * @param {string} type - Type of the record.
 * @param {string} message - Success message to log.
 * @param {string} resourceId - ID of the associated resource.
 * @param {string} rolloutId - ID of the rollout.
 * @param {string} tenantCode - Tenant code.
 * @param {string} orgCode - Organization code.
 * @param {string} creatorId - ID of the creator.
 * @param {string} assignedTo - ID of the assigned user.
 * @returns {Promise<void>} Resolves when the success record has been written to the CSV.
 */
async function writeSuccessRecord(
	csvWriter,
	programId,
	solutionId,
	type,
	message,
	resourceId,
	rolloutId,
	tenantCode,
	orgCode,
	creatorId,
	assignedTo
) {
	await csvWriter.writeRecords([
		{
			programId,
			solutionId,
			type,
			success: message,
			resourceId,
			rolloutId,
			tenantId: tenantCode,
			orgId: orgCode,
			creatorId,
			assignedTo,
		},
	])
}

/**
 * Writes an error record to a CSV file with details about the program and error message.
 * @async
 * @function writeErrorRecord
 * @param {Object} csvWriter - CSV writer instance with a `writeRecords` method.
 * @param {string} programId - ID of the program.
 * @param {string} solutionId - ID of the solution.
 * @param {string} type - Type of the record.
 * @param {string} error - Error message to log.
 * @param {string} resourceId - ID of the associated resource.
 * @param {string} rolloutId - ID of the rollout.
 * @param {string} tenantCode - Tenant code.
 * @param {string} orgCode - Organization code.
 * @param {string} creatorId - ID of the creator.
 * @param {string} assignedTo - ID of the assigned user.
 * @returns {Promise<void>} Resolves when the error record has been written to the CSV.
 */
async function writeErrorRecord(
	csvWriter,
	programId,
	solutionId,
	type,
	error,
	resourceId,
	rolloutId,
	tenantCode,
	orgCode,
	creatorId,
	assignedTo
) {
	await csvWriter.writeRecords([
		{
			programId,
			solutionId,
			type,
			success: `Error: ${error}`,
			resourceId,
			rolloutId,
			tenantId: tenantCode,
			orgId: orgCode,
			creatorId,
			assignedTo,
		},
	])
}

/**
 * Cleans up user cache and entity type mappings to prevent memory leaks.
 * @async
 * @function cleanupCaches
 * @param {Map} userCache - Map object storing cached user data.
 * @param {Object} entityTypeEntityMap - Object mapping tenant/org keys to entity type data.
 * @returns {Promise<void>} Resolves when caches have been cleaned up.
 */
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

	// Also clean entity caches if they get too large
	if (entityTypeCache.size > 500) {
		const keysToDelete = Array.from(entityTypeCache.keys()).slice(0, 100)
		keysToDelete.forEach((key) => entityTypeCache.delete(key))
	}

	if (entityCache.size > 1000) {
		const keysToDelete = Array.from(entityCache.keys()).slice(0, 200)
		keysToDelete.forEach((key) => entityCache.delete(key))
	}

	if (entityDetailsCache.size > 2000) {
		const keysToDelete = Array.from(entityDetailsCache.keys()).slice(0, 400)
		keysToDelete.forEach((key) => entityDetailsCache.delete(key))
	}

	console.log(
		`Cache stats: User: ${userCache.size}, Entity mappings: ${Object.keys(entityTypeEntityMap).length}, ` +
			`Types: ${entityTypeCache.size}, Queries: ${entityCache.size}, Details: ${entityDetailsCache.size}`
	)
}

/**
 * Generates targeting criteria based on scope and tenant code for entity management
 * @param {Object} [scope={}] - Scope object containing entity filters and targeting parameters
 * @param {string} tenant_code - The tenant code for database operations
 * @returns {Promise<Object>} Object with success status and result array containing targeting criteria
 */
async function generateTargetingCriteria(scope = {}, tenant_code) {
	try {
		if (!scope || Object.keys(scope).length === 0) {
			console.log('No valid targeting-related data found in scope. Returning empty targeting criteria.')
			return { success: true, result: [] }
		}

		// Define role entity types and excluded keys
		const roleEntityTypes = migrationConfig.ROLE_ENTITY_TYPES
		const excludedKeys = migrationConfig.EXCLUDED_KEYS_IN_SCOPE
		const locationEntityTypeHierarchy = migrationConfig.LOCATION_ENTITY_TYPE_HIERARCHY

		// Step 1: Filter scope keys to exclude irrelevant ones
		const scopeKeys = Object.keys(scope).filter((key) => !excludedKeys.includes(key))
		if (scopeKeys.length === 0) {
			return { success: true, result: [] }
		}

		console.log('Scope Keys:', scopeKeys)
		console.log('Scope:', scope)

		// Step 2: Fetch entity type details to determine location and role entities
		const entityTypeDetails = await fetchEntityTypesByQuery(scopeKeys, tenant_code)
		console.log('Entity Type Details:', entityTypeDetails)

		const locationEntityTypes = entityTypeDetails.filter((et) => et.isObservable === true).map((et) => et.name)
		const validRoleEntityTypes = entityTypeDetails
			.filter((et) => roleEntityTypes.includes(et.name))
			.map((et) => et.name)

		console.log('Location Entity Types:', locationEntityTypes)
		console.log('Valid Role Entity Types:', validRoleEntityTypes)

		// Step 3: Identify ALL flags and entities to fetch
		const entityAllFlags = {}
		const entitiesToFetch = {}

		scopeKeys.forEach((key) => {
			// Check if this key has 'ALL' value
			const isAll = scope[key] === 'ALL' || (Array.isArray(scope[key]) && scope[key].includes('ALL'))

			entityAllFlags[key] = isAll

			// For non-ALL values, get the IDs to fetch
			if (!isAll && Array.isArray(scope[key]) && scope[key].length > 0) {
				entitiesToFetch[key] = scope[key].filter((id) => id !== 'ALL')
			} else {
				entitiesToFetch[key] = []
			}
		})

		console.log('Entity ALL flags:', entityAllFlags)
		console.log('Entities to fetch:', entitiesToFetch)

		// Step 4: Fetch specific entities based on IDs
		const apiCalls = []

		// Fetch specific entities (non-ALL cases)
		for (const [key, idsToFetch] of Object.entries(entitiesToFetch)) {
			if (idsToFetch.length > 0) {
				console.log(`Fetching specific entities for ${key}:`, idsToFetch)
				apiCalls.push(
					fetchEntitiesByQuery(
						{ _id: { $in: idsToFetch }, entityType: key, tenantId: tenant_code },
						[
							'_id',
							'metaInformation',
							'entityType',
							'entityTypeId',
							'childHierarchyPath',
							'registryDetails',
							'parent',
						],
						tenant_code,
						key
					)
						.then((entities) => {
							return {
								type: key,
								entities,
								isAll: false,
							}
						})
						.catch((error) => {
							console.error(`Error fetching ${key}:`, error)
							return { type: key, entities: [], isAll: false }
						})
				)
			}
		}

		// Step 5: If state is ALL, fetch all states
		if (entityAllFlags.state) {
			console.log('Fetching ALL states')
			apiCalls.push(
				fetchEntitiesByQuery(
					{ entityType: 'state', tenantId: tenant_code },
					[
						'_id',
						'metaInformation',
						'entityType',
						'entityTypeId',
						'childHierarchyPath',
						'registryDetails',
						'parent',
					],
					tenant_code,
					'state'
				)
					.then((entities) => {
						return {
							type: 'state',
							entities,
							isAll: true,
						}
					})
					.catch((error) => {
						console.error('Error fetching all states:', error)
						return { type: 'state', entities: [], isAll: true }
					})
			)
		}

		const fetchedEntitiesByType = await Promise.all(apiCalls)
		console.log('All Fetched Entities:', fetchedEntitiesByType)

		// Step 6: Organize entities into role and location categories
		const professionalEntities = {}
		const locationEntitiesByType = {}

		fetchedEntitiesByType.forEach(({ type, entities, isAll }) => {
			if (validRoleEntityTypes.includes(type)) {
				const formattedEntities = entities.map((entity) => ({
					_id: entity._id,
					name: entity.metaInformation?.name || entity.title,
					externalId: entity.registryDetails?.code || entity.metaInformation?.externalId || entity.code,
				}))
				if (formattedEntities.length > 0) {
					professionalEntities[type] = formattedEntities
				}
			} else if (locationEntityTypes.includes(type)) {
				locationEntitiesByType[type] = entities.map((entity) => ({
					_id: entity._id,
					name: entity.metaInformation?.name || entity.title,
					externalId: entity.registryDetails?.code || entity.metaInformation?.externalId || entity.code,
					childHierarchyPath: entity.childHierarchyPath || [],
				}))
			}
		})

		console.log('Professional Entities:', professionalEntities)
		console.log('Location Entities by Type:', locationEntitiesByType)

		// Step 7: Handle case when only role entities are present (no location entities)
		const hasLocationEntityTypes = scopeKeys.some((key) => locationEntityTypes.includes(key))

		if (!hasLocationEntityTypes) {
			console.log('Only role entities present')
			const targetingObject = {}

			validRoleEntityTypes.forEach((roleType) => {
				if (professionalEntities[roleType] && professionalEntities[roleType].length > 0) {
					targetingObject[roleType] = professionalEntities[roleType]
				} else if (entityAllFlags[roleType]) {
					targetingObject[roleType] = 'ALL'
				}
			})

			if (Object.keys(targetingObject).length > 0) {
				return { success: true, result: [targetingObject] }
			}
			return { success: true, result: [] }
		}

		// Step 8: Fetch parent info for location entities (except states)
		const entityDetailsCalls = []

		Object.entries(locationEntitiesByType).forEach(([type, entities]) => {
			if (type !== 'state') {
				// Only need details for non-state entities
				entities.forEach((entity) => {
					entityDetailsCalls.push(
						fetchEntityDetails(entity._id, tenant_code)
							.then((details) => {
								return {
									entityId: entity._id,
									entityType: type,
									entityData: entity,
									details,
								}
							})
							.catch((error) => {
								console.error(`Error fetching details for ${entity._id}:`, error)
								return {
									entityId: entity._id,
									entityType: type,
									entityData: entity,
									details: null,
								}
							})
					)
				})
			}
		})

		const entityDetailsResults = await Promise.all(entityDetailsCalls)
		console.log('Entity Details Results:', entityDetailsResults)

		// Step 9: Group entities by state
		const entitiesByState = new Map()

		// First add any states directly in the scope
		if (locationEntitiesByType.state) {
			locationEntitiesByType.state.forEach((stateEntity) => {
				entitiesByState.set(stateEntity._id, {
					stateInfo: {
						_id: stateEntity._id,
						name: stateEntity.name,
						externalId: stateEntity.externalId,
					},
					childEntities: new Map(),
					hierarchyOrder: stateEntity.childHierarchyPath
						? ['state', ...stateEntity.childHierarchyPath]
						: locationEntityTypeHierarchy,
				})
			})
		}

		// Then add states derived from parent information
		entityDetailsResults.forEach(({ entityType, entityData, details }) => {
			if (details?.result?.[0]?.parentInformation?.state?.[0]) {
				const parentState = details.result[0].parentInformation.state[0]
				const stateId = parentState._id

				// Create state entry if not exists
				if (!entitiesByState.has(stateId)) {
					entitiesByState.set(stateId, {
						stateInfo: {
							_id: parentState._id,
							name: parentState.name,
							externalId: parentState.externalId,
						},
						childEntities: new Map(),
						hierarchyOrder: locationEntityTypeHierarchy,
					})
				}

				const stateData = entitiesByState.get(stateId)

				// Store all parent information by level
				if (details.result[0].parentInformation) {
					const parentInfo = details.result[0].parentInformation

					Object.keys(parentInfo).forEach((level) => {
						if (level !== 'state' && parentInfo[level] && parentInfo[level].length > 0) {
							if (!stateData.childEntities.has(level)) {
								stateData.childEntities.set(level, [])
							}

							parentInfo[level].forEach((parent) => {
								// Check if parent already exists to avoid duplicates
								const exists = stateData.childEntities
									.get(level)
									.some((existing) => existing._id === parent._id)

								if (!exists) {
									stateData.childEntities.get(level).push({
										_id: parent._id,
										name: parent.name,
										externalId: parent.externalId,
									})
								}
							})
						}
					})
				}

				// Add this entity to its type in the state's childEntities
				if (!stateData.childEntities.has(entityType)) {
					stateData.childEntities.set(entityType, [])
				}

				// Check if entity already exists
				const exists = stateData.childEntities
					.get(entityType)
					.some((existing) => existing._id === entityData._id)

				if (!exists) {
					stateData.childEntities.get(entityType).push({
						_id: entityData._id,
						name: entityData.name,
						externalId: entityData.externalId,
					})
				}
			}
		})

		// Step 10: Handle case when no state information is available but location entities exist
		if (entitiesByState.size === 0 && Object.keys(locationEntitiesByType).length > 0) {
			// Create a default state-less targeting object
			const targetingObject = {}

			// Add location entities
			let deepestLocationType = null
			let deepestLocationIndex = -1

			locationEntityTypeHierarchy.forEach((type, index) => {
				if (locationEntitiesByType[type] && locationEntitiesByType[type].length > 0) {
					targetingObject[type] = locationEntitiesByType[type].map((entity) => ({
						_id: entity._id,
						name: entity.name,
						externalId: entity.externalId,
					}))

					if (index > deepestLocationIndex) {
						deepestLocationIndex = index
						deepestLocationType = type
					}
				} else if (entityAllFlags[type]) {
					targetingObject[type] = 'ALL'

					if (index > deepestLocationIndex) {
						deepestLocationIndex = index
						deepestLocationType = type
					}
				}
			})

			// Set entity_targeting to the deepest location type
			if (deepestLocationType) {
				targetingObject.entity_targeting = deepestLocationType
			}

			// Add professional entities
			validRoleEntityTypes.forEach((roleType) => {
				if (professionalEntities[roleType] && professionalEntities[roleType].length > 0) {
					targetingObject[roleType] = professionalEntities[roleType]
				} else if (entityAllFlags[roleType]) {
					targetingObject[roleType] = 'ALL'
				}
			})

			return { success: true, result: [targetingObject] }
		}

		// Step 11: Build targeting criteria for each state
		const targetingCriteria = []

		for (const [stateId, stateData] of entitiesByState) {
			const targetingObject = {
				state: stateData.stateInfo,
			}

			// Handle hierarchy based on ALL flags and available entities
			const hierarchyOrder = stateData.hierarchyOrder || locationEntityTypeHierarchy

			// Find first ALL level and deepest specific entity level
			let firstAllLevel = null
			let firstAllLevelIndex = -1
			let deepestEntityType = null
			let deepestEntityIndex = 0

			for (let i = 0; i < hierarchyOrder.length; i++) {
				const level = hierarchyOrder[i]

				if (level === 'state') continue

				// Check for ALL flag
				if (entityAllFlags[level] && firstAllLevel === null) {
					firstAllLevel = level
					firstAllLevelIndex = i
				}

				// Check for entities at this level
				if (stateData.childEntities.has(level) && stateData.childEntities.get(level).length > 0) {
					if (i > deepestEntityIndex) {
						deepestEntityType = level
						deepestEntityIndex = i
					}
				}
			}

			// Determine entity_targeting and build hierarchy
			if (firstAllLevel) {
				// ALL case: Include all parent levels up to ALL level
				targetingObject.entity_targeting = firstAllLevel

				// Add all specific parent levels before the ALL level
				for (let i = 1; i < firstAllLevelIndex; i++) {
					const level = hierarchyOrder[i]
					if (stateData.childEntities.has(level) && stateData.childEntities.get(level).length > 0) {
						targetingObject[level] = stateData.childEntities.get(level)
					}
				}

				// Add the ALL level
				targetingObject[firstAllLevel] = 'ALL'
			} else if (deepestEntityType) {
				// Specific entity case: Use deepest level as entity_targeting
				targetingObject.entity_targeting = deepestEntityType

				// Add all levels up to deepest level
				for (let i = 1; i <= deepestEntityIndex; i++) {
					const level = hierarchyOrder[i]
					if (stateData.childEntities.has(level) && stateData.childEntities.get(level).length > 0) {
						targetingObject[level] = stateData.childEntities.get(level)
					}
				}
			} else {
				// Fallback case: Just target state level
				targetingObject.entity_targeting = 'state'

				// When state is ALL, include next level as ALL
				if (entityAllFlags.state) {
					const nextLevel = hierarchyOrder[1] || 'district'
					targetingObject[nextLevel] = 'ALL'
					targetingObject.entity_targeting = nextLevel
				}
			}

			validRoleEntityTypes.forEach((roleType) => {
				if (professionalEntities[roleType] && professionalEntities[roleType].length > 0) {
					targetingObject[roleType] = professionalEntities[roleType]
				} else if (entityAllFlags[roleType]) {
					targetingObject[roleType] = 'ALL'
				}
			})

			targetingCriteria.push(targetingObject)
		}

		console.log('Final targeting criteria:', targetingCriteria)
		return { success: true, result: targetingCriteria }
	} catch (error) {
		console.error('Error in generateTargetingCriteria:', error)
		return { success: false, error: error.message }
	}
}

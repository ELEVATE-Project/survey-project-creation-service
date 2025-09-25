/**
 * name : migrateProgramsAndSolutions.js
 * author : Priyanka Pradeep
 * created-date : 24-Aug-2024
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

// Constants for environment variables
const requiredEnv = [
	'MONGODB_URL',
	'CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL',
	'DEFAULT_ORG_ID',
	'CONSUMPTION_SERVICE_DOWNLOADBLE_URL',
]
const missingVariables = requiredEnv.filter((key) => !process.env[key])

if (missingVariables.length > 0) {
	throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`)
	process.exit(1)
}

const { MONGODB_URL } = process.env
const dbName = MONGODB_URL.split('/').pop()

// Configuration constants
const BATCH_SIZE = 10 // Process 10 programs at a time
const USER_CACHE_SIZE = 1000 // Cache up to 1000 users
const CURSOR_TIMEOUT = 30 * 60 * 1000 // 30 minutes cursor timeout

;(async () => {
	try {
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

		// Get total count for progress tracking
		totalCount = await db.collection('programs').countDocuments({
			scope: { $exists: true, $type: 'object', $ne: {} },
			components: { $exists: true, $type: 'array', $not: { $size: 0 } },
			tenantId: { $nin: [null, ''] },
			orgId: { $nin: [null, ''] },
		})

		console.log(`Found ${totalCount} programs to process`)

		// Create efficient aggregation pipeline
		const pipeline = [
			{
				$match: {
					scope: { $exists: true, $type: 'object', $ne: {} },
					components: { $exists: true, $type: 'array', $not: { $size: 0 } },
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
					components: 1,
					scope: 1,
					startDate: 1,
					endDate: 1,
				},
			},
			{ $sort: { tenantId: 1, orgId: 1 } },
			// { $limit: 1 }, // For testing - remove or comment out in production
		]

		// Use cursor for memory-efficient processing
		const cursor = db.collection('programs').aggregate(pipeline, {
			allowDiskUse: true,
			maxTimeMS: CURSOR_TIMEOUT,
			batchSize: BATCH_SIZE,
		})

		const entityKeys = ['categories', 'recommended_for', 'languages']
		let currentBatch = []
		let currentTenant = null

		// Process programs using cursor streaming
		while (await cursor.hasNext()) {
			const program = await cursor.next()

			// Group by tenant for batch processing
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

// Process a batch of programs efficiently
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

	// Get unique user IDs for this batch
	const userIds = [
		...new Set(programBatch.filter((p) => p.createdBy && p.createdBy !== 'SYSTEM').map((p) => p.createdBy)),
	]

	// Batch fetch user details if not in cache
	const uncachedUserIds = userIds.filter((id) => !userCache.has(id))
	if (uncachedUserIds.length > 0) {
		const userOrgTenantMap = await getUserOrgTenantDetails(uncachedUserIds, tenantCode)

		// Update cache with size limit
		Object.entries(userOrgTenantMap).forEach(([userId, userData]) => {
			if (userCache.size >= USER_CACHE_SIZE) {
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

	// Fetch full program details efficiently
	const programIds = programBatch.map((p) => p._id)
	const programs = await db
		.collection('programs')
		.find({ _id: { $in: programIds } })
		.toArray()

	// Process each program
	for (const program of programs) {
		await processProgram(program, db, csvWriter, entityKeys, entityTypeEntityMap, orgAdminCache, userOrgTenantMap)
	}
}

// Process individual program (main processing logic)
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
	const { organization_code, tenant_code, user_id, assignedTo } = await getOrgAndTenantWithFallback(
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
		let entityTypeDetails = await initializeEntityTypes(
			entityTypeMapKey,
			entityTypeEntityMap,
			entityKeys,
			organization_code,
			tenant_code
		)
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

	if (missingEntityTypes.length > 0) {
		console.log(`Skipping program ${programIdStr}: Missing EntityTypes: ${missingEntityTypes.join(', ')}`)
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

	let programTargetingCriteriaRes = await generateTargetingCriteria(program.scope, tenant_code)
	if (
		!programTargetingCriteriaRes.success ||
		!Array.isArray(programTargetingCriteriaRes.result) ||
		programTargetingCriteriaRes?.result?.length === 0
	) {
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

	let solutionTargetingMap = {}
	let validSolutionIds = []

	const solutionMongoIds = migrationUtils.normalizeToObjectIds(program.components)
	const solutions = await db
		.collection('solutions')
		.find({
			_id: { $in: solutionMongoIds },
			type: 'improvementProject',
		})
		.toArray()

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

	for (let solution of solutions) {
		console.log(`processing solution ${solution._id}`)
		let solutionIdStr = solution._id.toString()
		if (!solution?.projectTemplateId) {
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

		let solutionTargetingCriteriaRes = await generateTargetingCriteria(solution.scope, tenant_code)
		if (
			!solutionTargetingCriteriaRes.success ||
			!Array.isArray(solutionTargetingCriteriaRes.result) ||
			solutionTargetingCriteriaRes?.result?.length === 0
		) {
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
		const isProjectExist = await checkResourceExist(projectTemplateIdStr, 'project', tenant_code, organization_code)

		if (isProjectExist.success) {
			console.log(`Project Resource Exist for template ${projectTemplateIdStr}`)
			validSolutionIds.push(isProjectExist.resourceId)
			solutionTargetingMap[projectTemplateIdStr] = {
				projectResourceId: isProjectExist.resourceId,
				projectId: projectTemplateIdStr,
				solutionId: solutionIdStr,
			}
		} else {
			console.log(`Project Resource Not Exist for template ${projectTemplateIdStr}`)
			const projectTemplate = await db
				.collection('projectTemplates')
				.findOne({ _id: ObjectId(projectTemplateIdStr) })

			if (!projectTemplate?._id) {
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

			if (!Array.isArray(projectTemplate.tasks) || projectTemplate.tasks.length === 0) {
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
			const templateTasks = await db
				.collection('projectTemplateTasks')
				.find({ _id: { $in: projectTemplate.tasks } })
				.toArray()

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
			if (taskIdsToRemove.length > 0) {
				projectTemplate.taskDetails = projectTemplate.taskDetails.filter(
					(task) => !taskIdsToRemove.some((id) => id.equals(task._id))
				)
			}

			let convertedTemplate = await convertProjectTemplate(
				projectTemplate,
				user_id,
				organization_code,
				tenant_code
			)
			if (!convertedTemplate.success) {
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

			let taskIdMap = convertedTemplate.taskIdMap
			convertedTemplate = convertedTemplate.template
			convertedTemplate.meta = {
				start_date: solution.startDate || null,
				end_date: solution.endDate || null,
			}

			convertedTemplate.targeting_criteria = solutionTargetingCriteriaRes.result || []

			let entitiesToCreate = []
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

			if (solution?.certificateTemplateId) {
				let certificateRes = await handleCertificateTemplate(
					solution,
					projectTemplate,
					db,
					tenant_code,
					organization_code
				)
				if (
					certificateRes &&
					certificateRes.success &&
					certificateRes?.scpCertificateBaseTemplate &&
					certificateRes?.certificateTemplate?.criteria &&
					certificateRes?.certificateBaseTemplate
				) {
					let certificateCeriteriaRes = await generateCertificateCriteria(
						certificateRes.certificateTemplate,
						certificateRes.certificateBaseTemplate,
						certificateRes.scpCertificateBaseTemplate,
						taskIdMap
					)
					if (certificateCeriteriaRes.success && certificateCeriteriaRes.certificate) {
						convertedTemplate.certificate = certificateCeriteriaRes.certificate
					}
				}
			}

			let projectCreateResponse = await createProjectAndEntities(
				convertedTemplate,
				entityTypeEntityMap[entityTypeMapKey],
				entitiesToCreate,
				{},
				tenant_code,
				organization_code
			)
			if (!projectCreateResponse.success) {
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
			let updateResourceRes = await updateResource(projectCreateResponse.projectId, updatePayload)
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

			await db
				.collection('solutions')
				.updateOne({ _id: solution._id }, { $set: { scp_reference_id: projectCreateResponse.projectId } })

			validSolutionIds.push(projectCreateResponse.projectId)
			solutionTargetingMap[projectTemplate._id.toString()] = {
				projectResourceId: projectCreateResponse.projectId,
				projectId: projectTemplate._id.toString(),
				solutionId: solutionIdStr,
			}
		}
	}

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

	let convertedProgramTemplate = await convertProgramTemplate(program, user_id, organization_code, tenant_code)
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
	convertedProgramTemplate.targeting_criteria = programTargetingCriteriaRes.result || []

	convertedProgramTemplate.meta = {
		start_date: program.startDate || null,
		end_date: program.endDate || null,
	}

	const programCreationResponse = await createProgram(
		programIdStr,
		convertedProgramTemplate,
		convertedProgramTemplate.created_by,
		convertedProgramTemplate.organization_code,
		convertedProgramTemplate.tenant_code,
		validSolutionIds
	)

	if (!programCreationResponse.success || !programCreationResponse?.programId) {
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

	await db.collection('programs').updateOne({ _id: program._id }, { $set: { scp_reference_id: programResourceId } })

	let programDetail = await programService.details(programResourceId, convertedProgramTemplate.organization_code)

	if (programDetail.statusCode !== 200 || !programDetail?.result) {
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
		false
	)

	if (createProgramRolloutResponse.success) {
		await writeSuccessRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'Success',
			programDetail.id,
			createProgramRolloutResponse.rolloutId,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
	} else {
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

	let programRolloutId = createProgramRolloutResponse.result.id

	for (let solutionData of programDetail.resources) {
		// Convert solution rollout data
		let convertSolutionRolloutTemplate = _.pick(solutionData, [
			'title',
			'targeting_criteria',
			'organization_code',
			'user_id',
			'type',
			'created_by',
		])

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
			true
		)

		// Validate the solution rollout creation
		if (createSolutionRolloutResponse.statusCode != 200) {
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

async function convertProgramTemplate(program, user_id, organization_code, tenant_code) {
	try {
		const convertedTemplate = {
			title: program.title,
			objective: program.description,
			categories: Array.isArray(program.categories) ? program.categories.map((c) => c.name.toLowerCase()) : [],
			recommended_duration: program.duration || program.metaInformation?.duration,
			keywords: program.keywords,
			recommended_for: Array.isArray(program.recommendedFor)
				? program.recommendedFor.map((r) => r.toLowerCase())
				: [],
			languages: program.languages || ['en'],
			learning_resources: program.learningResources,
			licenses: 'cc_by_4.0',
			created_by: user_id.toString(),
			organization_code: organization_code.toString(),
			tenant_code: tenant_code.toString(),
			type: 'program',
			published_id: program._id,
			status: common.RESOURCE_STATUS_PUBLISHED,
			stage: common.RESOURCE_STAGE_DRAFT,
			is_reusable: false,
			is_deleted: false,
			meta: { start_date: program.startDate, end_date: program.endDate },
			targeting_criteria: [],
			solutions: [],
		}
		return { success: true, template: convertedTemplate }
	} catch (error) {
		return { success: false, error }
	}
}

async function convertProjectTemplate(template, user_id, organization_code, tenant_code) {
	try {
		const taskIdMap = {}
		const convertTask = (task, index) => {
			const newTaskId = uuidv4()
			taskIdMap[task._id] = newTaskId
			return {
				id: newTaskId,
				name: task.name,
				type: task.type,
				is_mandatory: task.isDeletable ? false : true,
				allow_evidences: true,
				evidence_details: {
					file_types: task.evidenceDetails?.fileTypes || ['images', 'document', 'videos', 'audio'],
					min_no_of_evidences: task.evidenceDetails?.minNoOfEvidences || 1,
				},
				learning_resources: Array.isArray(task.learningResources)
					? convertResources(task.learningResources)
					: [],
				sequence_no: task.sequenceNumber ? Number(task.sequenceNumber) : index + 1,
				children: task.children ? task.children.map(convertTask) : [],
			}
		}
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

async function handleCertificateTemplate(solution, projectTemplate, db, tenant_code, organization_code) {
	try {
		let result = {
			success: true,
			scpCertificateBaseTemplate: {},
			certificateTemplate: {},
			certificateBaseTemplate: {},
		}

		if (!solution?.certificateTemplateId) {
			return { success: false, error: 'No certificate template ID found' }
		}

		const certificateTemplate = await db
			.collection('certificateTemplates')
			.findOne({ _id: ObjectId(solution.certificateTemplateId) })

		if (!certificateTemplate?.baseTemplateId) {
			throw new Error('baseTemplateId not found in certificateTemplate')
		}

		// Get the certificate base template
		let certificateBaseTemplate = await db
			.collection('certificateBaseTemplates')
			.findOne({ _id: certificateTemplate.baseTemplateId })

		if (!certificateBaseTemplate?._id) {
			throw new Error('certificateBaseTemplate not found')
		}
		const certificateTemplateInSCP = await isCertificateBaseTemplateExist(
			certificateBaseTemplate.code,
			'project',
			tenant_code,
			organization_code
		)
		let scpCertificateBaseTemplate = {}
		if (certificateTemplateInSCP.success) {
			console.log(`Certificate Base template Exist for template ${projectTemplate._id.toString()}`)
			scpCertificateBaseTemplate = certificateTemplateInSCP.certificateBaseTemplate
		} else {
			//create certificate base template in scp
			console.log('certificateBaseTemplate Not found in SCP')

			//get svg template
			let templatesvgRes = await getSvgTemplate(certificateBaseTemplate)
			if (!templatesvgRes.success) {
				throw new Error('Failed to download svg template from consumption')
			}

			// Create the certificate base template in scp
			// Create a temporary file to store SVG content
			const fileName = `template_${Date.now()}.svg`
			const filePath = path.join(__dirname, fileName)
			fs.writeFileSync(filePath, templatesvgRes.svgTemplate, 'utf-8') // Save the SVG content to file

			// Prepare payload for signed URL
			const payloadData = {
				cert: {
					files: [fileName],
				},
				ref: common.CERTIFICATE,
			}

			// Get Signed URL to upload
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

			const fileUploadUrl = getSignedUrl.result['cert']['files'][0].url
			const uploadedFilePath = getSignedUrl.result['cert']['files'][0].file

			// Upload the file to signed URL
			const fileData = fs.readFileSync(filePath)
			await request({
				url: fileUploadUrl,
				method: 'put',
				headers: {
					'Content-Type': 'application/octet-stream', // Correct content type for SVG file uploads
				},
				body: fileData,
			})

			// Prepare certificate data to save in DB
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
 * Downloads and parses SVG template to extract metadata like logos and signatures.
 * @param {Object} certificateBaseTemplate - Certificate base template containing the URL.
 * @returns {Promise<Object>} - An object with success status, SVG content, and extracted metadata.
 */
async function getSvgTemplate(certificateBaseTemplate) {
	try {
		let result = {
			success: true,
			svgTemplate: null,
			certificateMeta: {},
		}

		let templateUrl = certificateBaseTemplate?.url
		if (!templateUrl) {
			throw new Error('Template URL not provided')
		}

		//download the svg template
		const svgTemplateRes = await generateDownloadableUrlInConsumption(
			process.env.INTERFACE_SERVICE_HOST +
				process.env.CONSUMPTION_SERVICE_BASE_URL +
				process.env.CONSUMPTION_SERVICE_DOWNLOADBLE_URL +
				'?file=' +
				templateUrl
		)

		if (!svgTemplateRes.success || !svgTemplateRes?.file) {
			throw new Error('svg Template Not Found')
		}

		result.svgTemplate = svgTemplateRes.file

		// Parse SVG Content
		const parser = new DOMParser()
		const svgDoc = parser.parseFromString(svgTemplateRes.file, 'image/svg+xml')

		const logoImages = svgDoc.getElementsByTagName('image')
		const signatureImages = svgDoc.getElementsByTagName('image')

		const logos = {}
		const signatures = {}
		const signatureTitles = {}

		let logoCount = 0
		let signatureCount = 0

		// Identify and count logos
		for (let i = 0; i < logoImages.length; i++) {
			const id = logoImages[i].getAttribute('id') || ''
			const className = logoImages[i].getAttribute('class') || ''
			if (id.toLowerCase().includes('logo') || className.toLowerCase().includes('logo')) {
				logoCount++
				logos[id] = null
			}
		}

		// Identify and count signatures
		for (let i = 0; i < signatureImages.length; i++) {
			const id = signatureImages[i].getAttribute('id') || ''
			const className = signatureImages[i].getAttribute('class') || ''
			if (id.toLowerCase().includes('signature') || className.toLowerCase().includes('signature')) {
				signatureCount++
				signatures[`signatureImg${signatureCount}`] = null
				signatureTitles[`signatureTitleName${signatureCount}`] = 'Name'
				signatureTitles[`signatureTitleDesignation${signatureCount}`] = 'Designation'
			}
		}

		// Add counts to respective objects
		logos['no_of_logos'] = logoCount
		signatures['no_of_signature'] = signatureCount

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
			base_template_url: scpCertificateBaseTemplate?.url || '',
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
		if (entitiesToCreate.length > 0) {
			for (const entity of entitiesToCreate) {
				if (entity.value) {
					let entityCreationData = {
						entity_type_id: entity.entity_type_id,
						value: entity.value,
						label: entity.label || entity.value,
						tenant_code: tenant_code,
						organization_code: organization_code,
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
						//remove entity from create
						entitiesToCreate = entitiesToCreate.filter(
							(entity) =>
								!(entity.entity_type_id === entity.entity_type_id && entity.value === entity.value)
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

		const project = await projectService.create(
			{ ...convertedTemplate, solutions, is_reusable: false },
			convertedTemplate.created_by,
			organization_code,
			tenant_code
		)
		if (project.statusCode != 200) {
			return { success: false, error: project.error }
		}
		return { success: true, projectId: project.result.id }
	} catch (error) {
		return { success: false, error }
	}
}

async function updateResource(resourceId, payload) {
	try {
		let result = {
			success: true,
			updatedResource: null,
		}
		const updateOptions = {
			returning: true,
			raw: true,
		}

		const updatedResource = await resourceQueries.updateOne({ id: resourceId }, payload, updateOptions)
		result.updatedResource = updatedResource
		return result
	} catch (error) {
		return { success: false, error }
	}
}

async function checkResourceExist(publishedId, type, tenant_code, organization_code) {
	try {
		let resource = await resourceQueries.findOne(
			{ published_id: publishedId, type: type, tenant_code, organization_code },
			{ attributes: ['id'] }
		)
		if (!resource || !resource.id) {
			throw new Error('Resource Not Found')
		}
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
			})
		}

		const updateProgram = await resourceService.publishCallback(createProgramRes.result.id, programId.toString())
		if (updateProgram.statusCode != 202) {
			throw new Error('Failed to update program')
		}

		return { success: true, programId: createProgramRes.result.id }
	} catch (error) {
		console.log('Failed to create program ', programId)
		return { success: false, error }
	}
}

async function getOrgAndTenantWithFallback(createdBy, userOrgTenantMap, programTenantId, programOrgId, orgAdminCache) {
	let organization_code = programOrgId
	let tenant_code = programTenantId
	let user_id = createdBy

	if (createdBy && userOrgTenantMap[createdBy]) {
		organization_code = userOrgTenantMap[createdBy]?.user_organizations?.[0]?.organization_code || programOrgId
		tenant_code = userOrgTenantMap[createdBy]?.tenant_code || programTenantId
	}

	if (!user_id || user_id === 'SYSTEM') {
		const cacheKey = `${organization_code}:${tenant_code}`
		if (!orgAdminCache[cacheKey]) {
			const orgAdminId = await getDefaultOrgAdmin(tenant_code, organization_code)
			if (!orgAdminId) {
				console.warn(`No default org admin found for org: ${organization_code}, tenant: ${tenant_code}`)
				return { organization_code, tenant_code, user_id: null, assignedTo: 'SYSTEM' }
			}
			orgAdminCache[cacheKey] = orgAdminId
		}
		user_id = orgAdminCache[cacheKey]
		return { organization_code, tenant_code, user_id, assignedTo: 'SYSTEM_ADMIN' }
	}

	return { organization_code, tenant_code, user_id, assignedTo: user_id }
}

async function getDefaultOrgAdmin(tenantId, orgId) {
	const orgDetails = await userRequest.fetchOrg(orgId, tenantId)
	if (
		orgDetails.success &&
		Array.isArray(orgDetails?.data?.result?.org_admin) &&
		orgDetails.data.result.org_admin.length > 0
	) {
		return orgDetails.data.result.org_admin[0]
	}
	return null
}

async function initializeEntityTypes(
	entityTypeMapKey,
	entityTypeEntityMap,
	entityKeys,
	organization_code,
	tenant_code
) {
	try {
		const entityTypes = await entityTypeService.readUserEntityTypes(
			{ value: entityKeys },
			'',
			organization_code,
			tenant_code
		)

		if (entityTypes.statusCode != 200 || !entityTypes?.result?.entity_types?.length) {
			throw new Error(`Failed to fetch entities for tenant: ${tenant_code}, org: ${organization_code}`)
		}
		entityTypeEntityMap[entityTypeMapKey] = {}
		entityTypes.result.entity_types.forEach((entityType) => {
			if (entityKeys.includes(entityType.value)) {
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

async function filterNonExistingEntities(key, values, entityTypeMap, entitiesToCreate, tenant_code, organization_code) {
	const existingEntities = new Set(entityTypeMap[key]?.entities || [])
	const nonExisting = values.filter((v) => !existingEntities.has(v))
	if (nonExisting.length > 0) {
		entitiesToCreate.push({
			entity_type_id: entityTypeMap[key].entity_type_id,
			entities: nonExisting.map((value) => ({ value, label: value, created_by: null })),
			tenant_code,
			organization_code,
		})
	}
}

function generateEntityTypeMapKey(tenant_code, organization_code) {
	return `${tenant_code}:${organization_code}`
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

function convertResources(resources) {
	return resources
		.filter(({ link }) => !!link)
		.map(({ name, link }) => ({
			name: name || 'Resource',
			url: link,
		}))
}

async function getUserOrgTenantDetails(userIds, tenantCode) {
	const users = await userRequest.list('all', '', '', '', '', tenantCode, { user_ids: userIds })
	return users.success && users.data?.result?.data?.length > 0 ? _.keyBy(users.data.result.data, 'id') : {}
}

function logProgress(processed, total) {
	const percentage = ((processed / total) * 100).toFixed(2)
	console.log(`Processing progress: ${processed}/${total} (${percentage}%)`)
}

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

async function fetchEntityTypesByQuery(entityTypeNames, tenantId) {
	try {
		const apiUrl = `${process.env.INTERFACE_SERVICE_HOST}${process.env.CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL}${endpoints.ENTITY_TYPES_FIND_BY_QUERY}`

		const payload = {
			query: {
				name: {
					$in: entityTypeNames,
				},
				tenantId: tenantId,
			},
			projection: ['_id', 'isObservable', 'name', 'tenantId'],
		}

		const response = await axios.post(apiUrl, payload, {
			headers: {
				'content-type': 'application/json',
				'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
			},
		})

		if (response.status === 200 && response.data && Array.isArray(response.data.result)) {
			return response.data.result || []
		} else {
			console.error('Failed to fetch entityTypes:', response.status)
			return []
		}
	} catch (error) {
		console.error('Error fetching entityTypes:', error)
		return []
	}
}

async function fetchEntitiesByQuery(filter, projection, tenantId, entityType) {
	try {
		const apiUrl = `${process.env.INTERFACE_SERVICE_HOST}${process.env.CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL}${endpoints.FIND_ENTITIES_BY_QUERY}`
		const payload = {
			query: filter,
			projection: projection,
		}

		const response = await axios.post(apiUrl, payload, {
			headers: {
				'content-type': 'application/json',
				'internal-access-token': process.env.INTERNAL_ACCESS_TOKEN,
			},
		})

		if (response.status === 200 && response.data && Array.isArray(response.data.result)) {
			return response.data.result || []
		} else {
			console.error(`Failed to fetch ${entityType}:`, response.status, response.data)
			return []
		}
	} catch (error) {
		console.error(`Error fetching ${entityType}:`, error)
		return []
	}
}

async function fetchEntityDetails(entityId, tenantId) {
	try {
		const apiUrl = `${process.env.INTERFACE_SERVICE_HOST}${process.env.CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL}v1/entities/details/${entityId}`
		const response = await axios.get(apiUrl, {
			headers: {
				'content-type': 'application/json',
				tenantId: tenantId,
			},
		})

		if (response.status === 200 && response.data) {
			return response.data
		} else {
			console.error(`Failed to fetch entity details for ${entityId}:`, response.status)
			return null
		}
	} catch (error) {
		console.error(`Error fetching entity details for ${entityId}:`, error)
		return null
	}
}

async function generateTargetingCriteria(scope = {}, tenant_code) {
	try {
		if (!scope || Object.keys(scope).length === 0) {
			console.log('No valid targeting-related data found in scope. Returning empty targeting criteria.')
			return { success: true, result: [] }
		}

		// Define role entity types and excluded keys
		const roleEntityTypes = ['professional_role', 'professional_subroles']
		const excludedKeys = ['entityType', 'organizations', 'roles']

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

		let locationEntityTypes = entityTypeDetails.filter((et) => et.isObservable === true).map((et) => et.name)
		const validRoleEntityTypes = entityTypeDetails
			.filter((et) => roleEntityTypes.includes(et.name))
			.map((et) => et.name)

		console.log('Location Entity Types:', locationEntityTypes)
		console.log('Valid Role Entity Types:', validRoleEntityTypes)

		// Step 3: Check if state is "ALL" - if yes, fetch all states with full entity details
		const isStateAll = scope.state === 'ALL' || (Array.isArray(scope.state) && scope.state.includes('ALL'))

		// Fetch entities for non-"ALL" values and handle state "ALL" case
		const apiCalls = []
		for (const key of scopeKeys) {
			if (scope[key] && Array.isArray(scope[key]) && scope[key].length > 0) {
				const idsToFetch = scope[key].filter((id) => id !== 'ALL')
				if (idsToFetch.length > 0) {
					console.log(`Fetching entities for ${key}:`, idsToFetch)
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
								console.log(`Fetched ${key} entities:`, entities)
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
			} else if (key === 'state' && isStateAll) {
				// Fetch all states with their childHierarchyPath for determining next level
				console.log('Fetching all entities for state (ALL case)')
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
							console.log(`Fetched all state entities:`, entities)
							return {
								type: 'state',
								entities,
								isAll: true,
							}
						})
						.catch((error) => {
							console.error(`Error fetching all states:`, error)
							return { type: 'state', entities: [], isAll: true }
						})
				)
			}
		}

		const fetchedEntitiesByType = await Promise.all(apiCalls)
		console.log('All Fetched Entities:', fetchedEntitiesByType)

		// Step 4: Organize entities into role and location categories
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
					childHierarchyPath: entity.childHierarchyPath || [], // Keep hierarchy info
				}))
			}
		})

		console.log('Professional Entities:', professionalEntities)
		console.log('Location Entities by Type:', locationEntitiesByType)

		// Step 5: Handle case when only role entities are present
		if (scopeKeys.every((key) => validRoleEntityTypes.includes(key))) {
			console.log('Only role entities present')
			const targetingObject = {}
			validRoleEntityTypes.forEach((roleType) => {
				const key = roleType === 'professional_role' ? 'professional_roles' : 'professional_subroles'
				if (professionalEntities[roleType] && professionalEntities[roleType].length > 0) {
					targetingObject[key] = professionalEntities[roleType]
				}
			})
			if (Object.keys(targetingObject).length > 0) {
				return { success: true, result: [targetingObject] }
			}
			return { success: true, result: [] }
		}

		// Step 6: If state is "ALL", create targeting criteria for each state
		if (isStateAll && locationEntitiesByType.state && locationEntitiesByType.state.length > 0) {
			console.log('Processing state "ALL" case with fetched states')

			const targetingCriteria = []

			// For each state, create a targeting object
			for (const stateEntity of locationEntitiesByType.state) {
				const targetingObject = {}

				// Add state information (without childHierarchyPath in final output)
				targetingObject.state = {
					_id: stateEntity._id,
					name: stateEntity.name,
					externalId: stateEntity.externalId,
				}

				// Determine the immediate next entity type from childHierarchyPath
				let nextEntityType = null
				if (stateEntity.childHierarchyPath && stateEntity.childHierarchyPath.length > 0) {
					nextEntityType = stateEntity.childHierarchyPath[0] // First element is the immediate next level
				}

				// If no childHierarchyPath or empty, default to 'district'
				if (!nextEntityType) {
					nextEntityType = 'district'
				}

				// Set the next entity type as "ALL" and set entity_targeting
				targetingObject[nextEntityType] = 'ALL'
				targetingObject.entity_targeting = nextEntityType

				// Add professional entities only if they have data
				validRoleEntityTypes.forEach((roleType) => {
					const key = roleType === 'professional_role' ? 'professional_roles' : 'professional_subroles'
					if (professionalEntities[roleType] && professionalEntities[roleType].length > 0) {
						targetingObject[key] = professionalEntities[roleType]
					}
				})

				targetingCriteria.push(targetingObject)
			}

			console.log('Final targeting criteria for state ALL:', targetingCriteria)
			return { success: true, result: targetingCriteria }
		}

		// Step 7: Handle normal case (no state "ALL")
		const hasLocationEntities = Object.keys(locationEntitiesByType).length > 0
		console.log('Has Location Entities:', hasLocationEntities)

		if (!hasLocationEntities) {
			console.log('No location entities found')
			const targetingObject = {}

			// Add professional entities only if they have data
			validRoleEntityTypes.forEach((roleType) => {
				const key = roleType === 'professional_role' ? 'professional_roles' : 'professional_subroles'
				if (professionalEntities[roleType] && professionalEntities[roleType].length > 0) {
					targetingObject[key] = professionalEntities[roleType]
				}
			})

			// Get dynamic hierarchy order from scope or use default
			const defaultHierarchy = ['state', 'district', 'block', 'cluster', 'school']
			let entityTargeting = null

			defaultHierarchy.forEach((type) => {
				if (scope[type] === 'ALL' || (Array.isArray(scope[type]) && scope[type].includes('ALL'))) {
					targetingObject[type] = 'ALL'
					if (!entityTargeting) {
						entityTargeting = type
					}
				}
			})

			if (entityTargeting) {
				targetingObject.entity_targeting = entityTargeting
			}

			if (Object.keys(targetingObject).length > 0) {
				console.log('Returning basic targeting object:', targetingObject)
				return { success: true, result: [targetingObject] }
			}
			return { success: true, result: [] }
		}

		// Step 8: Fetch detailed information for location entities to get parent hierarchy
		const entityDetailsCalls = []

		Object.entries(locationEntitiesByType).forEach(([type, entities]) => {
			entities.forEach((entity) => {
				entityDetailsCalls.push(
					fetchEntityDetails(entity._id, tenant_code)
						.then((details) => {
							console.log(`Details for ${type} ${entity._id}:`, details)
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
		})

		const entityDetailsResults = await Promise.all(entityDetailsCalls)
		console.log('Entity Details Results:', entityDetailsResults)

		// Step 9: Build hierarchy and group entities by state with all parent information
		const entitiesByState = new Map()

		entityDetailsResults.forEach(({ entityId, entityType, entityData, details }) => {
			let stateInfo = null
			let allParentInfo = {}
			let hierarchyOrder = ['state', 'district', 'block', 'cluster', 'school'] // default

			if (entityType === 'state') {
				stateInfo = {
					_id: entityData._id,
					name: entityData.name,
					externalId: entityData.externalId,
				}
				// Use the state's childHierarchyPath as the hierarchy order
				if (entityData.childHierarchyPath && entityData.childHierarchyPath.length > 0) {
					hierarchyOrder = ['state', ...entityData.childHierarchyPath]
				}
			} else if (details?.result?.[0]?.parentInformation) {
				const parentInfo = details.result[0].parentInformation

				// Extract state information
				if (parentInfo.state && parentInfo.state[0]) {
					const parentState = parentInfo.state[0]
					stateInfo = {
						_id: parentState._id,
						name: parentState.name,
						externalId: parentState.externalId,
					}
				}

				// Extract all parent information for all hierarchy levels
				Object.keys(parentInfo).forEach((level) => {
					if (parentInfo[level] && parentInfo[level].length > 0) {
						allParentInfo[level] = parentInfo[level].map((parent) => ({
							_id: parent._id,
							name: parent.name,
							externalId: parent.externalId,
						}))
					}
				})
			}

			if (stateInfo) {
				if (!entitiesByState.has(stateInfo._id)) {
					entitiesByState.set(stateInfo._id, {
						stateInfo: stateInfo,
						parentInfo: {},
						childEntities: new Map(),
						hierarchyOrder: hierarchyOrder, // Store hierarchy for this state
					})
				}

				const stateData = entitiesByState.get(stateInfo._id)

				// Store parent information for this state
				Object.keys(allParentInfo).forEach((level) => {
					if (!stateData.parentInfo[level]) {
						stateData.parentInfo[level] = new Map()
					}
					allParentInfo[level].forEach((parent) => {
						stateData.parentInfo[level].set(parent._id, parent)
					})
				})

				if (entityType !== 'state') {
					if (!stateData.childEntities.has(entityType)) {
						stateData.childEntities.set(entityType, [])
					}
					stateData.childEntities.get(entityType).push({
						_id: entityData._id,
						name: entityData.name,
						externalId: entityData.externalId,
						parentInfo: allParentInfo, // Store parent info for this specific entity
					})
				}
			}
		})

		console.log('Entities grouped by state with parent info:', entitiesByState)

		// Step 10: Build targeting criteria with correct hierarchy handling
		const targetingCriteria = []

		if (entitiesByState.size === 0) {
			console.log('No state grouping found, creating single targeting object')
			const targetingObject = {}

			// Use default hierarchy order
			const defaultHierarchy = ['state', 'district', 'block', 'cluster', 'school']
			let entityTargeting = null

			defaultHierarchy.forEach((type) => {
				if (locationEntitiesByType[type] && locationEntitiesByType[type].length > 0) {
					// Remove childHierarchyPath from final output
					targetingObject[type] = locationEntitiesByType[type].map((entity) => ({
						_id: entity._id,
						name: entity.name,
						externalId: entity.externalId,
					}))
					entityTargeting = type
				} else if (scope[type] === 'ALL' || (Array.isArray(scope[type]) && scope[type].includes('ALL'))) {
					targetingObject[type] = 'ALL'
					if (!entityTargeting) {
						entityTargeting = type
					}
				}
			})

			if (entityTargeting) {
				targetingObject.entity_targeting = entityTargeting
			}

			// Add professional entities only if they have data
			validRoleEntityTypes.forEach((roleType) => {
				const key = roleType === 'professional_role' ? 'professional_roles' : 'professional_subroles'
				if (professionalEntities[roleType] && professionalEntities[roleType].length > 0) {
					targetingObject[key] = professionalEntities[roleType]
				}
			})

			if (Object.keys(targetingObject).length > 0) {
				targetingCriteria.push(targetingObject)
			}
		} else {
			console.log(`Creating ${entitiesByState.size} targeting objects for states`)

			for (const [stateId, stateData] of entitiesByState) {
				const targetingObject = {}

				// Add state information
				targetingObject.state = stateData.stateInfo

				// Use the dynamic hierarchy order for this state
				const hierarchyOrder = stateData.hierarchyOrder || ['state', 'district', 'block', 'cluster', 'school']

				// Find the first "ALL" level in scope to determine where to stop
				let firstAllLevel = null
				let firstAllLevelIndex = -1

				for (let i = 0; i < hierarchyOrder.length; i++) {
					const level = hierarchyOrder[i]
					if (scope[level] === 'ALL' || (Array.isArray(scope[level]) && scope[level].includes('ALL'))) {
						firstAllLevel = level
						firstAllLevelIndex = i
						break
					}
				}

				// If we found an ALL level, add all parent entities up to that level
				if (firstAllLevel && firstAllLevelIndex > 0) {
					// Add all parent levels up to the ALL level
					for (let i = 1; i < firstAllLevelIndex; i++) {
						// Skip state (index 0)
						const currentLevel = hierarchyOrder[i]

						// Check if we have entities for this level
						if (
							stateData.childEntities.has(currentLevel) &&
							stateData.childEntities.get(currentLevel).length > 0
						) {
							targetingObject[currentLevel] = stateData.childEntities.get(currentLevel).map((entity) => ({
								_id: entity._id,
								name: entity.name,
								externalId: entity.externalId,
							}))
						} else if (stateData.parentInfo[currentLevel] && stateData.parentInfo[currentLevel].size > 0) {
							// Use parent info if no direct entities
							targetingObject[currentLevel] = Array.from(stateData.parentInfo[currentLevel].values())
						}
					}

					// Add the ALL level
					targetingObject[firstAllLevel] = 'ALL'
					targetingObject.entity_targeting = firstAllLevel
				} else {
					// No ALL level found, find the deepest level that has entities
					let entityTargeting = 'state'
					let deepestLevel = 'state'

					// Find the deepest level that has entities
					for (const level of hierarchyOrder) {
						if (stateData.childEntities.has(level) && stateData.childEntities.get(level).length > 0) {
							deepestLevel = level
							entityTargeting = level
						}
					}

					// Add all parent entities up to the deepest level
					const deepestLevelIndex = hierarchyOrder.indexOf(deepestLevel)

					for (let i = 1; i <= deepestLevelIndex; i++) {
						// Skip state (index 0)
						const currentLevel = hierarchyOrder[i]

						if (i === deepestLevelIndex) {
							// This is the deepest level - add the actual entities
							if (stateData.childEntities.has(currentLevel)) {
								targetingObject[currentLevel] = stateData.childEntities
									.get(currentLevel)
									.map((entity) => ({
										_id: entity._id,
										name: entity.name,
										externalId: entity.externalId,
									}))
							}
						} else {
							// This is a parent level - add parent entities if available
							if (stateData.parentInfo[currentLevel] && stateData.parentInfo[currentLevel].size > 0) {
								targetingObject[currentLevel] = Array.from(stateData.parentInfo[currentLevel].values())
							}
						}
					}

					targetingObject.entity_targeting = entityTargeting
				}

				// Add professional entities only if they have data
				validRoleEntityTypes.forEach((roleType) => {
					const key = roleType === 'professional_role' ? 'professional_roles' : 'professional_subroles'
					if (professionalEntities[roleType] && professionalEntities[roleType].length > 0) {
						targetingObject[key] = professionalEntities[roleType]
					}
				})

				targetingCriteria.push(targetingObject)
			}
		}

		console.log('Final targeting criteria:', targetingCriteria)
		return { success: true, result: targetingCriteria }
	} catch (error) {
		console.error('Error in generateTargetingCriteria:', error)
		return { success: false, error: error.message }
	}
}

/**
 * name : migrateProgram.js
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
					_id: ObjectId('682c3e4076d1f500145763cf'),
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
			{ $limit: 1 }, // For testing - remove or comment out in production
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
		await initializeEntityTypes(entityTypeMapKey, entityTypeEntityMap, entityKeys, organization_code, tenant_code)
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

	let validateScopeRes = await validateScope(program?.scope, tenant_code)
	if (!validateScopeRes.isScopeValid) {
		console.log(`Scope is not found for program id ${programIdStr}, `)
		await writeErrorRecord(
			csvWriter,
			programIdStr,
			null,
			common.RESOURCE_TYPE_PROGRAM,
			'program scope is not valid',
			null,
			null,
			tenant_code,
			organization_code,
			program.createdBy || 'N/A',
			assignedTo
		)
		return
	}

	// generate targeting criteria for program scope
	let programTargetingCriteriaRes = await generateTargetingCriteria(program.scope, tenant_code, validateScopeRes)
	if (!programTargetingCriteriaRes.success) {
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
	console.log(JSON.stringify(solutionMongoIds, null, 2), 'solutionMongoIds')
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

		let isSolutionScopeValid = (await validateScope(solution?.scope, tenant_code)) || false
		if (!isSolutionScopeValid) {
			console.log(`Scope is not found for solution id ${solutionIdStr}, `)
			await writeErrorRecord(
				csvWriter,
				programIdStr,
				solutionIdStr,
				common.ROLLOUT_TYPE_SOLUTION,
				'solution scope is not valid',
				null,
				null,
				tenant_code,
				organization_code,
				solution.createdBy || 'N/A',
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
			convertedTemplate.targeting_criteria = []
			if (solution?.scope) {
				let targetingCriteriaRes = await generateTargetingCriteria(solution.scope, tenant_code)
				if (!targetingCriteriaRes.success) {
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
					continue
				}
				convertedTemplate.targeting_criteria = targetingCriteriaRes.result || []
			}

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

	convertedProgramTemplate.targeting_criteria = []
	if (program?.scope) {
		convertedProgramTemplate.targeting_criteria = programTargetingCriteriaRes.result || []
	}

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

async function generateTargetingCriteria(scope = {}, tenant_code) {
	try {
		if (!scope || Object.keys(scope).length === 0) {
			console.log('No valid targeting-related data found in scope. Returning empty targeting criteria.')
			return { success: true, result: [] }
		}

		const entityTypeIds = scope.entityType ? scope.entityType.split(',').map((item) => item.trim()) : []
		const apiCalls = []

		// Prepare API calls for each entity type in the scope
		for (const type of entityTypeIds) {
			if (scope[type] && scope[type].length > 0) {
				apiCalls.push(
					fetchEntitiesByQuery(scope[type], tenant_code, type).then((entities) => ({ type, entities }))
				)
			}
		}

		// Fetch all entities in parallel
		const fetchedEntitiesByType = await Promise.all(apiCalls)

		const professionalEntities = {}
		const locationEntities = []

		// Separate entities into professional and location-based
		fetchedEntitiesByType.forEach(({ type, entities }) => {
			if (type === 'professional_role' || type === 'professional_subroles') {
				professionalEntities[type] = entities.map((entity) => ({
					_id: entity._id,
					value: entity.code || entity.metaInformation?.code,
					label: entity.title || entity.metaInformation?.name,
					code: entity.code || entity.metaInformation?.code,
				}))
			} else {
				entities.forEach((entity) => {
					locationEntities.push({
						_id: entity._id,
						externalId: entity.registryDetails?.code || entity.metaInformation?.externalId,
						name: entity.metaInformation?.name,
						entityType: entity.entityType,
					})
				})
			}
		})

		const targetingCriteriaByHighestEntity = new Map()

		for (const entity of locationEntities) {
			const highestParent = await findHighestEntityInHierarchy(entity._id, tenant_code)
			const highestParentId = highestParent?._id

			if (!highestParentId) {
				continue // Skip if no highest parent is found
			}

			if (!targetingCriteriaByHighestEntity.has(highestParentId)) {
				// Initialize the targeting object for this highest-level entity
				const highestParentType = highestParent.entityType
				const newTargetingObject = {
					[highestParentType]: [
						{
							_id: highestParent._id,
							name: highestParent.metaInformation?.name,
							externalId:
								highestParent.registryDetails?.code || highestParent.metaInformation?.externalId,
						},
					],
					entity_targeting: {
						_id: entityTypeIds[0], // Assuming the first entityType in the list is the primary one
						value: entityTypeIds[0],
						name: entityTypeIds[0],
					},
				}
				// Add all professional roles and subroles to this new targeting object
				Object.assign(newTargetingObject, professionalEntities)
				targetingCriteriaByHighestEntity.set(highestParentId, newTargetingObject)
			}

			const currentTargeting = targetingCriteriaByHighestEntity.get(highestParentId)
			if (!currentTargeting[entity.entityType]) {
				currentTargeting[entity.entityType] = []
			}
			currentTargeting[entity.entityType].push({
				_id: entity._id,
				externalId: entity.registryDetails?.code || entity.metaInformation?.externalId,
				name: entity.metaInformation?.name || entity.label,
				entityType: entity.entityType,
			})
		}

		const finalTargeting = Array.from(targetingCriteriaByHighestEntity.values())

		return { success: true, result: finalTargeting }
	} catch (error) {
		console.error('Error in generateTargetingCriteria:', error)
		return { success: false, error: error.message }
	}
}

// async function generateTargetingCriteria(scope = {}, tenant_code) {
//     try {
//         if (!scope || Object.keys(scope).length === 0) {
//             console.log('No valid targeting-related data found in scope. Returning empty targeting criteria.')
//             return { success: true, result: [] }
//         }

//         const entityTypeIds = scope.entityType ? scope.entityType.split(',').map((item) => item.trim()) : []
//         const apiCalls = []

//         // Prepare API calls for each entity type in the scope
//         for (const type of entityTypeIds) {
//             if (scope[type] && scope[type].length > 0) {
//                 apiCalls.push(
//                     fetchEntitiesByQuery(scope[type], tenant_code, type).then((entities) => ({ type, entities }))
//                 )
//             }
//         }

//         // Fetch all entities in parallel
//         const fetchedEntitiesByType = await Promise.all(apiCalls)

//         const professionalEntities = {}
//         const locationEntities = []

//         // Separate entities into professional and location-based
//         fetchedEntitiesByType.forEach(({ type, entities }) => {
//             if (type === 'professional_role' || type === 'professional_subroles') {
//                 professionalEntities[type] = entities.map((entity) => ({
//                     _id: entity._id,
//                     value: entity.code || entity.metaInformation?.code,
//                     label: entity.title || entity.metaInformation?.name,
//                     code: entity.code || entity.metaInformation?.code,
//                 }))
//             } else {
//                 entities.forEach((entity) => {
//                     locationEntities.push({
//                         _id: entity._id,
//                         externalId: entity.registryDetails?.code || entity.metaInformation?.externalId,
//                         name: entity.metaInformation?.name,
//                         entityType: entity.entityType,
//                     })
//                 })
//             }
//         })

//         const targetingCriteriaByHighestEntity = new Map()

//         for (const entity of locationEntities) {
//             const highestParent = await findHighestEntityInHierarchy(entity._id, tenant_code)
//             const highestParentId = highestParent?._id

//             if (!highestParentId) {
//                 continue // Skip if no highest parent is found
//             }

//             if (!targetingCriteriaByHighestEntity.has(highestParentId)) {
//                 // Initialize the targeting object for this highest-level entity
//                 const highestParentType = highestParent.entityType
//                 const newTargetingObject = {
//                     [highestParentType]: [
//                         {
//                             _id: highestParent._id,
//                             name: highestParent.metaInformation?.name,
//                             externalId:
//                                 highestParent.registryDetails?.code || highestParent.metaInformation?.externalId,
//                         },
//                     ],
//                     entity_targeting: {
//                         _id: entityTypeIds[0], // Assuming the first entityType in the list is the primary one
//                         value: entityTypeIds[0],
//                         name: entityTypeIds[0],
//                     },
//                 }
//                 // Add all professional roles and subroles to this new targeting object
//                 Object.assign(newTargetingObject, professionalEntities)
//                 targetingCriteriaByHighestEntity.set(highestParentId, newTargetingObject)
//             }

//             const currentTargeting = targetingCriteriaByHighestEntity.get(highestParentId)
//             if (!currentTargeting[entity.entityType]) {
//                 currentTargeting[entity.entityType] = []
//             }
//             currentTargeting[entity.entityType].push({
//                 _id: entity._id,
//                 externalId: entity.registryDetails?.code || entity.metaInformation?.externalId,
//                 name: entity.metaInformation?.name || entity.label,
//                 entityType: entity.entityType,
//             })
//         }

//         const finalTargeting = Array.from(targetingCriteriaByHighestEntity.values())

//         return { success: true, result: finalTargeting }
//     } catch (error) {
//         console.error('Error in generateTargetingCriteria:', error)
//         return { success: false, error: error.message }
//     }
// }

async function fetchEntitiesByQuery(entityIds, tenantId, entityType) {
	try {
		const apiUrl = `${process.env.INTERFACE_SERVICE_HOST}${process.env.CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL}${endpoints.FIND_ENTITIES_BY_QUERY}`

		const payload = {
			query: {
				_id: {
					$in: entityIds,
				},
				entityType: entityType,
				tenantId: tenantId,
			},
			projection: [
				'_id',
				'metaInformation',
				'entityType',
				'entityTypeId',
				'childHierarchyPath',
				'registryDetails',
			],
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

async function findHighestEntityInHierarchy(entityId, tenant_code) {
	try {
		let currentEntityId = entityId
		let highestEntity = null

		while (currentEntityId) {
			const entities = await fetchEntitiesByQuery([currentEntityId], tenant_code)
			const currentEntity = entities[0]

			if (!currentEntity) {
				return highestEntity
			}

			highestEntity = currentEntity
			if (currentEntity.parent && currentEntity.parent._id) {
				currentEntityId = currentEntity.parent._id
			} else {
				// No parent found, this is the highest entity
				currentEntityId = null
			}
		}
		return highestEntity
	} catch (error) {
		console.error('Error finding highest entity in hierarchy:', error)
		return null
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
	} catch (error) {
		console.error(`Error initializing entity types for ${entityTypeMapKey}:`, error)
		entityTypeEntityMap[entityTypeMapKey] = {} // Ensure map is initialized to avoid future errors
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

// Enhanced validation function that uses isObservable to categorize entities
async function validateScope(scope, tenant_code) {
	try {
		if (!scope || typeof scope !== 'object' || Object.keys(scope).length === 0) {
			return {
				isValid: false,
				error: 'Scope is empty or invalid',
				entities: [],
				scopeKeys: [],
				entityTypes: [],
			}
		}

		let excludedKeys = ['roles', 'entityType', 'organizations']

		const scopeKeys = Object.keys(scope)
		const filteredScopeKeys = scopeKeys.filter((key) => !excludedKeys.includes(key))

		if (filteredScopeKeys.length === 0) {
			return {
				isValid: false,
				error: 'No valid entities found in scope after excluding ignored keys',
				entities: [],
				scopeKeys: [],
				entityTypes: [],
			}
		}

		let entityTypeDetails = await fetchEntityTypesByQuery(filteredScopeKeys, tenant_code)
		if (!entityTypeDetails || entityTypeDetails.length === 0) {
			return {
				isValid: false,
				error: 'No valid entity types found for the given scope',
				entities: [],
				scopeKeys: [],
				entityTypes: [],
			}
		}

		// Check if all scope keys have corresponding entity types
		const foundEntityTypeNames = entityTypeDetails.map((et) => et.name)
		const missingEntityTypes = filteredScopeKeys.filter((key) => !foundEntityTypeNames.includes(key))

		if (missingEntityTypes.length > 0) {
			return {
				isScopeValid: false,
				error: `Entity types not found for: ${missingEntityTypes.join(', ')}`,
				entities: [],
				scopeKeys: filteredScopeKeys,
				entityTypes: entityTypeDetails,
			}
		}

		const validationPromises = []
		const entityCategories = {
			roleEntities: [],
			locationEntities: [],
		}

		const allEntitiesData = []

		// Process each filtered scope key
		for (const scopeKey of filteredScopeKeys) {
			if (scope[scopeKey] && Array.isArray(scope[scopeKey]) && scope[scopeKey].length > 0) {
				// Get entity type info for categorization
				const entityTypeInfo = entityTypeDetails.find((et) => et.name === scopeKey)

				if (entityTypeInfo) {
					// Categorize based on isObservable property from entity type
					if (entityTypeInfo.isObservable === false) {
						entityCategories.roleEntities.push(scopeKey)
					} else {
						entityCategories.locationEntities.push(scopeKey)
					}
				}

				// Filter out "ALL" values for entity fetching
				const idsToValidate = scope[scopeKey].filter((id) => id !== 'ALL')

				if (idsToValidate.length > 0) {
					// Fetch actual entities to validate they exist
					validationPromises.push(
						fetchEntitiesByQuery(idsToValidate, tenant_code, scopeKey).then((entities) => ({
							scopeKey,
							entities,
							originalIds: idsToValidate,
							hasAllValue: scope[scopeKey].includes('ALL') || scope[scopeKey] == 'ALL',
							entityTypeInfo,
						}))
					)
				} else if (scope[scopeKey].includes('ALL')) {
					// Handle ALL-only case
					validationPromises.push(
						Promise.resolve({
							scopeKey,
							entities: [],
							originalIds: [],
							hasAllValue: true,
							isAllOnly: true,
							entityTypeInfo,
						})
					)
				}
			}
		}

		if (validationPromises.length === 0) {
			return {
				isScopeValid: false,
				error: 'No valid entity values found in scope',
				entities: [],
				scopeKeys: filteredScopeKeys,
				entityTypes: entityTypeDetails,
			}
		}

		const validationResults = await Promise.all(validationPromises)

		// Categorize entities based on isObservable property
		// Validate entities and collect data
		for (const result of validationResults) {
			const { scopeKey, entities, originalIds, hasAllValue, isAllOnly, entityTypeInfo } = result

			// Skip entity existence check for ALL-only cases
			if (!isAllOnly) {
				// Check if all entities exist
				if (entities.length !== originalIds.length) {
					return {
						isScopeValid: false,
						error: `Some ${scopeKey} entities not found. Expected: ${originalIds.length}, Found: ${entities.length}`,
						entities: allEntitiesData,
						scopeKeys: filteredScopeKeys,
						entityTypes: entityTypeDetails,
					}
				}
			}

			// Collect entity data for response
			allEntitiesData.push({
				scopeKey,
				entityType: entityTypeInfo,
				entities: entities,
				hasAllValue,
				isAllOnly: isAllOnly || false,
				originalScopeValues: scope[scopeKey],
			})
		}

		// Final validation: ensure we have at least some valid data
		if (entityCategories.roleEntities.length === 0 && entityCategories.locationEntities.length === 0) {
			return {
				isScopeValid: false,
				error: 'No valid role or location entities found in scope',
				entities: allEntitiesData,
				scopeKeys: filteredScopeKeys,
				entityTypes: entityTypeDetails,
			}
		}

		return {
			isScopeValid: true,
			entities: allEntitiesData,
			scopeKeys: filteredScopeKeys,
			entityTypes: entityTypeDetails,
			entityCategories: entityCategories,
			summary: {
				roleEntities: entityCategories.roleEntities,
				locationEntities: entityCategories.locationEntities,
				totalValidKeys: filteredScopeKeys.length,
				totalEntitiesFound: allEntitiesData.reduce((sum, item) => sum + item.entities.length, 0),
			},
		}
	} catch (error) {
		return {
			isScopeValid: false,
			error: error.message,
			entities: [],
			scopeKeys: [],
			entityTypes: [],
		}
	}
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

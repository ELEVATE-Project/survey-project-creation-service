/**
 * name : migrateProgramsAndSolutions.js
 * author : Priyanka Pradeep
 * created-date : 18-Feb-2025
 * Description : Script to migrate programs and solutions from consumption side.
 */

// Dependencies
require('module-alias/register')
require('dotenv').config({ path: '../../.env' })
require('../../configs/events')()

const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const _ = require('lodash')
const { MongoClient, ObjectID: ObjectId } = require('mongodb')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const axios = require('axios')
const { DOMParser } = require('xmldom')

const requests = require('@generics/requests')
const migrationUtils = require('./utils')
const utils = require('@generics/utils')

const entityTypeService = require('@services/entity-types')
const projectService = require('@services/projects')
const entityService = require('@services/entities')
const resourceService = require('@services/resource')
const programService = require('@services/programs')
const rolloutService = require('@services/rollouts')
const fileService = require('@services/files')

const request = require('request')

const resourceQueries = require('@database/queries/resources')
const certificateBaseTemplateQueries = require('@database/queries/certificateBaseTemplate')
const programResourceMappingQueries = require('@database/queries/programResourceMapping')
const certificateQueries = require('@database/queries/certificateBaseTemplate')

const common = require('@constants/common')
const userRequest = require('@requests/user')

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
				{ id: 'resourceId', title: 'Resource ID' },
				{ id: 'rolloutId', title: 'Rollout ID' },
			],
		})

		let csvRecords = []

		// Get default userId
		const DEFAULT_USER_ID = await getDefaultUserId()
		if (!DEFAULT_USER_ID) {
			throw new Error('Failed to get default org admin')
		}

		// Get all programs with scope and solutions exists
		const programsData = await db
			.collection('programs')
			.find({
				scope: {
					$exists: true,
					$type: 'object',
					$ne: {},
				},
				components: {
					$exists: true,
					$type: 'array',
					$not: { $size: 0 },
				},
			})
			.project({ _id: 1 })
			.toArray()

		console.log(`${programsData.length} programs found`)

		const entityKeys = ['categories', 'recommended_for', 'languages']
		let entityTypeEntityMap = {
			categories: { entity_type_id: null, entities: [] },
			recommended_for: { entity_type_id: null, entities: [] },
			languages: { entity_type_id: null, entities: [] },
		}

		// Get the entities for the project
		let entities = await entityTypeService.readUserEntityTypes(
			{ value: entityKeys },
			'1',
			process.env.DEFAULT_ORG_ID
		)

		let entityTypesWithEntities = entities?.result?.entity_types || []
		if (!entityTypesWithEntities.length) {
			throw new Error('Failed to fetch entities')
		}

		// Create entity type and entity map
		entityTypesWithEntities.forEach((entityType) => {
			if (entityTypeEntityMap[entityType.value]) {
				entityTypeEntityMap[entityType.value].entity_type_id = entityType.id
				entityTypeEntityMap[entityType.value].entities = entityType.entities.map((entity) => entity.value)
			}
		})

		let createdEntityIds = {}
		let entitiesToCreate = []

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

			// Process each program
			for (const program of programs) {
				let programIdStr = program._id.toString()
				console.log(`Processing program ${programIdStr}`)

				// Check if the program exists
				const isProgramExist = await checkResourceExist(programIdStr, common.RESOURCE_TYPE_PROGRAM)
				//update mongo

				if (isProgramExist.success) {
					console.log(`Program Exist for template ${programIdStr}`)
					csvRecords.push({
						programId: programIdStr,
						solutionId: '',
						type: common.RESOURCE_TYPE_PROGRAM,
						success: 'Program Exist',
						resourceId: isProgramExist.resourceId,
						rolloutId: '',
					})
					continue
				}

				// convert the program components into array of object id
				const solutionMongoIds = program.components.map((stringId) => new ObjectId(stringId))
				console.log(`${solutionMongoIds.length} solutionIds found for program ${programIdStr}`)

				// get all the solutions
				const solutions = await db
					.collection('solutions')
					.find({
						_id: { $in: solutionMongoIds },
						type: 'improvementProject',
					})
					.toArray()

				if (solutions.length <= 0) {
					console.log(`No project solution found ${programIdStr}`)
					csvRecords.push({
						programId: programIdStr,
						solutionId: '',
						type: common.RESOURCE_TYPE_PROGRAM,
						success: 'No Solution Found',
						resourceId: '',
						rolloutId: '',
					})
					continue
				}

				let solutionTargetingMap = {}
				let validSolutionIds = []

				//process each solution
				for (let solution of solutions) {
					console.log(`processing solution ${solution._id}`)
					let solutionIdStr = solution._id.toString()
					// Find the project templates
					if (!solution?.projectTemplateId) {
						//skip the solution
						console.log(`No project template found for solution id ${solutionIdStr}, `)
						csvRecords.push({
							programId: programIdStr,
							solutionId: solutionIdStr,
							type: common.ROLLOUT_TYPE_SOLUTION,
							success: 'No project template found for solution',
							resourceId: '',
							rolloutId: '',
						})
						continue
					}

					let projectTemplateIdStr = solution.projectTemplateId.toString()
					//find the project template in scp
					const isProjectExist = await checkResourceExist(projectTemplateIdStr, 'project')
					if (isProjectExist.success) {
						console.log(`Project Resource Exist for template ${projectTemplateIdStr}`)
						validSolutionIds.push(isProjectExist.resourceId)
						solutionTargetingMap[projectTemplateIdStr] = {
							projectResourceId: isProjectExist.resourceId,
							projectId: projectTemplateIdStr,
							solutionId: solutionIdStr,
						}
					} else {
						//create the project template in scp
						console.log(`Project Resource Not Exist for template ${projectTemplateIdStr}`)
						//create project template
						const projectTemplate = await db
							.collection('projectTemplates')
							.findOne({ _id: ObjectId(projectTemplateIdStr) })

						// validate the project template
						if (!projectTemplate?._id) {
							console.log(`No project template found for solution id ${solutionIdStr}, `)
							csvRecords.push({
								programId: programIdStr,
								solutionId: solutionIdStr,
								type: common.ROLLOUT_TYPE_SOLUTION,
								success: 'No project template found',
								resourceId: '',
								rolloutId: '',
							})
							continue
						}

						// get task of the project template
						if (!Array.isArray(projectTemplate.tasks) || !projectTemplate.tasks.length > 0) {
							console.log(`No Task Found for Project Template ${solutionIdStr}, `)
							csvRecords.push({
								programId: programIdStr,
								solutionId: solutionIdStr,
								type: common.ROLLOUT_TYPE_SOLUTION,
								success: 'No project template found',
								resourceId: '',
								rolloutId: '',
							})
							continue
						}

						let taskIdsToRemove = []
						// fetch the task from projectTemplateTasks collection
						const templateTasks = await db
							.collection('projectTemplateTasks')
							.find({ _id: { $in: projectTemplate.tasks } })
							.toArray()

						// Validate the template task
						if (!templateTasks.length > 0) {
							console.log(`No Task Found for Project Template ${solutionIdStr}, `)
							csvRecords.push({
								programId: programIdStr,
								solutionId: solutionIdStr,
								type: common.ROLLOUT_TYPE_SOLUTION,
								success: 'No Task Found for Project Template',
								resourceId: '',
								rolloutId: '',
							})
							continue
						}

						projectTemplate.taskDetails = templateTasks

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
							projectTemplate.taskDetails = projectTemplate.taskDetails.filter(
								(task) => !taskIdsToRemove.some((id) => id.equals(task._id))
							)
						}

						// Convert template
						let convertedTemplate = await convertProjectTemplate(
							projectTemplate,
							userOrgMap,
							DEFAULT_USER_ID
						)

						// Fail to convert project template
						if (!convertedTemplate.success) {
							csvRecords.push({
								programId: programIdStr,
								solutionId: solutionIdStr,
								type: common.ROLLOUT_TYPE_SOLUTION,
								success: 'Failed to convert the project template',
								resourceId: '',
								rolloutId: '',
							})
							continue
						}

						//add task object id uuid map to replace task id in certificate criteria
						let taskIdMap = convertedTemplate.taskIdMap
						convertedTemplate = convertedTemplate.template

						//Add start date, end date from solution
						convertedTemplate.meta = {
							start_date: solution.startDate || null,
							end_date: solution.endDate || null,
						}

						// Generate the targeting criteria
						convertedTemplate.targeting_criteria = []
						if (solution?.scope) {
							let targetingCriteriaRes = await generateTargetingCriteria(solution.scope, db)
							if (!targetingCriteriaRes.success) {
								throw new Error('Failed to generate targeting criteria')
							}

							convertedTemplate.targeting_criteria = targetingCriteriaRes.result || []
						}

						// Find non-existing entities sequentially
						for (const key of entityKeys) {
							let values = convertedTemplate[key]
							if (Array.isArray(values) && values.length > 0) {
								values = [...new Set(values)]
								convertedTemplate[key] = migrationUtils.formatValues(values)

								await filterNonExistingEntities(key, values, entityTypeEntityMap, entitiesToCreate)
							}
						}

						// If certificate exist then add certificate criteria object
						if (solution?.certificateTemplateId) {
							let certificateRes = await handleCertificateTemplate(solution, projectTemplate, db)

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

								//update the resource with certificate object
								if (certificateCeriteriaRes.success && certificateCeriteriaRes.certificate) {
									convertedTemplate.certificate = certificateCeriteriaRes.certificate
								}
							}
						}

						// Create the project and entities after conversion
						let projectCreateResponse = await createProjectAndEntities(
							projectTemplate._id.toString(),
							convertedTemplate,
							entityTypeEntityMap,
							entitiesToCreate,
							createdEntityIds
						)

						if (!projectCreateResponse.success) {
							csvRecords.push({
								programId: programIdStr,
								solutionId: solutionIdStr,
								type: common.ROLLOUT_TYPE_SOLUTION,
								success: 'Project resource creation failed',
								resourceId: '',
								rolloutId: '',
							})
							continue
						}

						//update and publish resource
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
							console.log(`Failed to update or publish resource for solution ${solutionIdStr}`)
							csvRecords.push({
								programId: programIdStr,
								solutionId: solutionIdStr,
								type: common.ROLLOUT_TYPE_SOLUTION,
								success: 'Failed to update or publish resource',
								resourceId: '',
								rolloutId: '',
							})
							continue
						}

						//add resource id in solution mongo
						await db.collection('solutions').updateOne(
							{
								_id: solution._id,
							},
							{ $set: { scp_reference_id: projectCreateResponse.projectId } }
						)

						// Add solution to mapping
						validSolutionIds.push(projectCreateResponse.projectId)
						solutionTargetingMap[projectTemplate._id.toString()] = {
							projectResourceId: projectCreateResponse.projectId,
							projectId: projectTemplate._id.toString(),
							solutionId: solutionIdStr,
						}
					}
				}

				//if atleast one valid solution is there then create the program
				if (!validSolutionIds.length > 0) {
					csvRecords.push({
						programId: programIdStr,
						solutionId: '',
						type: common.RESOURCE_TYPE_PROGRAM,
						success: 'No solution found',
						resourceId: '',
						rolloutId: '',
					})
					continue
				}

				// Convert the program template
				let convertedProgramTemplate = await convertProgramTemplate(program, userOrgMap, DEFAULT_USER_ID)

				//validate the program template
				if (!convertedProgramTemplate.success) {
					throw new Error(convertedProgramTemplate.error)
				}
				convertedProgramTemplate = convertedProgramTemplate.template

				//generate targeting criteria for program
				convertedProgramTemplate.targeting_criteria = []
				if (program?.scope) {
					let programTargetingCriteriaRes = await generateTargetingCriteria(program.scope, db)
					if (!programTargetingCriteriaRes.success) {
						throw new Error('Failed to generate targeting criteria')
					}

					convertedProgramTemplate.targeting_criteria = programTargetingCriteriaRes.result || []
				}

				//Add start date, end date from solution
				convertedProgramTemplate.meta = {
					start_date: program.startDate || null,
					end_date: program.endDate || null,
				}

				//create program
				const programCreationResponse = await createProgram(
					programIdStr,
					convertedProgramTemplate,
					convertedProgramTemplate.created_by,
					convertedProgramTemplate.organization_id,
					validSolutionIds
				)

				// Validate program creation
				if (!programCreationResponse.success || !programCreationResponse?.programId) {
					console.log(`Failed to create program ${programIdStr}`)
					csvRecords.push({
						programId: programIdStr,
						solutionId: '',
						type: common.RESOURCE_TYPE_PROGRAM,
						success: 'Failed to create program',
						resourceId: '',
						rolloutId: '',
					})
					continue
				}

				let programResourceId = programCreationResponse.programId

				//update resource id in program doc
				await db.collection('programs').updateOne(
					{
						_id: program._id,
					},
					{ $set: { scp_reference_id: programResourceId } }
				)

				// Get the program details
				let programDetail = await programService.details(
					programResourceId,
					convertedProgramTemplate.organization_id
				)

				// Validate the program details
				if (programDetail.statusCode !== 200 || !programDetail?.result) {
					throw new Error('Failed to fetch the program details')
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
					convertedProgramRolloutTemplate.organization_id,
					false
				)

				//Validate the program rollout creation
				if (createProgramRolloutResponse.statusCode != 200 || !createProgramRolloutResponse?.result?.id) {
					console.log(`Failed to create program ${programIdStr}`, createProgramRolloutResponse.error)
					csvRecords.push({
						programId: programIdStr,
						solutionId: '',
						type: common.RESOURCE_TYPE_PROGRAM,
						success: 'Failed to create program rollout',
						resourceId: '',
						rolloutId: '',
					})
					continue
				}

				let programRolloutId = createProgramRolloutResponse.result.id

				for (let solutionData of programDetail.resources) {
					// Convert solution rollout data
					let convertSolutionRolloutTemplate = _.pick(solutionData, [
						'title',
						'targeting_criteria',
						'organization_id',
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
						convertSolutionRolloutTemplate.organization_id,
						true
					)

					// Validate the solution rollout creation
					if (createSolutionRolloutResponse.statusCode != 200) {
						console.log(
							`Failed to create solution rollout ${programIdStr}`,
							createSolutionRolloutResponse.error
						)
						csvRecords.push({
							programId: programIdStr,
							solutionId: solutionTargetingMap[solutionData.published_id].solutionId,
							type: common.ROLLOUT_TYPE_SOLUTION,
							success: 'Failed to create solution rollout',
							resourceId: '',
							rolloutId: '',
						})
						continue
					}

					//update the solution rollout status
					await rolloutService.publishCallback(
						createSolutionRolloutResponse.result.id,
						solutionTargetingMap[solutionData.published_id].solutionId,
						solutionTargetingMap[solutionData.published_id].projectId
					)

					csvRecords.push({
						programId: programIdStr,
						solutionId: solutionTargetingMap[solutionData.published_id].solutionId,
						type: common.ROLLOUT_TYPE_SOLUTION,
						success: 'Success',
						resourceId: solutionData.id,
						rolloutId: createSolutionRolloutResponse.result.id,
					})
				}

				//update the program rollout status
				await rolloutService.publishCallback(programRolloutId, programIdStr)

				csvRecords.push({
					programId: programIdStr,
					solutionId: '',
					type: common.RESOURCE_TYPE_PROGRAM,
					success: 'Success',
					resourceId: programDetail.id,
					rolloutId: programRolloutId,
				})
			}
		}
		// Write data to csv
		await csvWriter.writeRecords(csvRecords)
		console.log('Migration completed')
		await client.close()
		console.log('Connection closed')
	} catch (error) {
		console.error('Error during migration:', error)
		return error
	}
})()

/**
 * Fetches and returns the default organization admin user ID
 * @name getDefaultUserId
 * @returns {String} default organization admin user ID
 */
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

/**
 * Fetches and returns a map of user IDs to their organization details
 * @name getUserOrgDetails
 * @param {Array<string>} userIds - Array of user IDs
 * @returns {Object} Map of user IDs to organization details
 */
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

/**
 * Checks if a resource exists based on published ID and type
 * @name checkResourceExist
 * @param {String} publishedId - Published ID of the resource
 * @param {String} type - Type of the resource
 * @returns {Object} Object containing success status and resource ID or error
 */
async function checkResourceExist(publishedId, type) {
	try {
		let resource = await resourceQueries.findOne(
			{
				published_id: publishedId,
				type: type,
			},
			{
				attributes: ['id'],
			}
		)

		// Check if the resource exists
		if (!resource || !resource.id) {
			throw new Error('Resource Not Found')
		}

		return {
			success: true,
			resourceId: resource.id,
		}
	} catch (error) {
		return {
			success: false,
			error,
		}
	}
}

/**
 * Converts a project template to a standardized format with tasks and metadata
 * @name convertProjectTemplate
 * @param {Object} template - The project template object to be converted
 * @param {Object} userOrgMap - Map of user IDs to their organization details
 * @param {String} DEFAULT_USER_ID - Default user ID to use if creator is not found in userOrgMap
 * @returns {Object} Object containing success status and the converted template or error
 */
async function convertProjectTemplate(template, userOrgMap, DEFAULT_USER_ID) {
	try {
		const taskIdMap = {}

		let userId = DEFAULT_USER_ID
		let orgId = process.env.DEFAULT_ORG_ID
		if (userOrgMap[template.createdBy]) {
			userId = template.createdBy
			orgId = userOrgMap[template.createdBy].organization.id
		}

		// Helper function to convert tasks and their children
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
					? migrationUtils.convertResources(task.learningResources)
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
			recommended_duration: migrationUtils.convertDuration(
				template.duration || template.metaInformation.duration
			),
			keywords: migrationUtils.convertKeywords(template.keywords),
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
				? migrationUtils.convertResources(template.learningResources)
				: [],
			licenses: 'cc_by_4.0',
			created_by: userId.toString(),
			organization_id: orgId.toString(),
			published_id: template._id,
			tasks: template.taskDetails ? template.taskDetails.map(convertTask) : [],
			targeting_criteria: [],
		}

		return { success: true, template: convertedTemplate, taskIdMap: taskIdMap }
	} catch (error) {
		console.error('Error occurred while converting the template:', error)
		return { success: false, error }
	}
}

/**
 * Filters out entities that already exist and prepares a list of new entities to be created
 * @name filterNonExistingEntities
 * @param {String} entityTypeKey - The key representing the entity type
 * @param {Array} values - Array of entity values to check
 * @param {Object} entityTypeEntityMap - Map of entity types to their existing entities and IDs
 * @param {Array} entitiesToCreate - Array to accumulate non-existing entities for creation
 * @returns {Array} Updated array of entities to be created
 */
async function filterNonExistingEntities(entityTypeKey, values, entityTypeEntityMap, entitiesToCreate) {
	if (entityTypeEntityMap.hasOwnProperty(entityTypeKey)) {
		const entityTypeId = entityTypeEntityMap[entityTypeKey].entity_type_id
		const existingEntities = new Set(entityTypeEntityMap[entityTypeKey].entities)
		// Filter and push non-existing values in one step
		values.forEach((value) => {
			// Check if the value already exists in entitiesToCreate with the same entity_type_id
			const alreadyExists = entitiesToCreate.some(
				(entity) =>
					entity.entity_type_id == entityTypeId && entity.value == migrationUtils.formatEntityValue(value)
			)

			// If the value is not present in existingEntities and not already in entitiesToCreate
			if (value && !existingEntities.has(migrationUtils.formatEntityValue(value)) && !alreadyExists) {
				entitiesToCreate.push({
					entity_type_id: entityTypeId,
					value: migrationUtils.formatEntityValue(value),
					label: migrationUtils.formatTitle(value),
				})
			}
		})
	}

	return entitiesToCreate
}

/**
 * Creates non-existing entities and then creates a project based on the provided template data
 * @name createProjectAndEntities
 * @param {String} templateId - The ID of the project template
 * @param {Object} templateData - Data of the template to create the project
 * @param {Object} entityTypeEntityMap - Map of entity types and their existing entities
 * @param {Array} entitiesToCreate - Array of entities to be created if they don't exist
 * @param {Object} createdEntityIds - Map to collect IDs of newly created entities categorized by entity type
 * @returns {Object} Result object containing success status and created project ID or error
 */
async function createProjectAndEntities(
	templateId,
	templateData,
	entityTypeEntityMap,
	entitiesToCreate,
	createdEntityIds
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

		// Proceed to create the project after entities are processed
		const projectCreationResponse = await createProject(
			templateId,
			templateData,
			templateData.created_by,
			templateData.organization_id
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

/**
 * Creates a new project from the provided template data and updates it using publish callback
 * @name createProject
 * @param {String} templateId - The ID of the project template
 * @param {Object} projectData - Data to create the project
 * @param {String} userId - User ID who is creating the project
 * @param {String} orgId - Organization ID associated with the project
 * @returns {Object} Result object containing success status and created project ID or error
 */
async function createProject(templateId, projectData, userId, orgId) {
	try {
		// Logic to create the project
		const createProject = await projectService.create(projectData, userId, orgId)
		if (!createProject?.result?.id) {
			throw new Error('Failed to create project')
		}

		return { success: true, projectId: createProject.result.id }
	} catch (error) {
		console.log('Failed to create project ', projectData.published_id)
		return { success: false, error }
	}
}

/**
 * Publishes a project using the given project and template IDs.
 * @param {string} projectId - The ID of the project to publish.
 * @param {string} templateId - The ID of the template associated with the project.
 * @returns {Object} - Result of the publish operation.
 */
async function publishProject(projectId, templateId) {
	try {
		const publishProjectRes = await resourceService.publishCallback(projectId, templateId.toString())
		if (publishProjectRes.statusCode != 202) {
			throw new Error('Failed to update project')
		}
		return { success: true, projectId: projectId }
	} catch (error) {
		console.log('Failed to publish project ', templateId)
		return { success: false, error }
	}
}

/**
 * Converts a program template into a standard format for creation
 * @name convertProgramTemplate
 * @param {Object} template - The program template object to be converted
 * @param {Object} userOrgMap - Map of user IDs to their organization details
 * @param {String} DEFAULT_USER_ID - Default user ID to fallback if creator is not found
 * @returns {Object} Result object containing success status and the converted program template or error
 */
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
			keywords: migrationUtils.convertKeywords(template.keywords),
			licenses: 'cc_by_4.0',
			resources: [],
		}

		return { success: true, template: convertedTemplate }
	} catch (error) {
		console.error('Error occurred while converting the program template:', error)
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
async function createProgram(programId, programData, userId, orgId, solutionIds) {
	try {
		// Logic to create the program
		const createProgramRes = await programService.create(programData, userId, orgId)
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
				organization_id: orgId,
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

/**
 * Generates dynamic targeting criteria based on provided scope, roles, and entity hierarchy.
 * @param {Object} scope - The scope object containing roles, entity types, and entities to target.
 * @param {Object} db - MongoDB database instance for querying collections.
 * @returns {Object} array of targeting criteria
 */
async function generateTargetingCriteria(scope = {}, db) {
	try {
		let targetingCriteria = []

		// Return empty if scope is empty or has no valid targeting data
		if (!scope || Object.keys(scope).length === 0 || !hasValidTargetingData(scope)) {
			console.log('No valid targeting-related data found in scope. Returning empty targeting criteria.')
			return { success: true, result: [] }
		}

		// Normalize roles from scope
		let roles = []
		if (scope?.roles?.length > 0) {
			let roleCodes = []
			if (typeof scope.roles === 'string') {
				// If roles is a string like 'HM,DEO'
				roleCodes = scope.roles.split(',').map((code) => code.trim())
			} else if (Array.isArray(scope.roles)) {
				// If roles is an array
				roleCodes = scope.roles.flatMap((r) => {
					if (typeof r === 'object' && r.code) return [r.code]
					if (typeof r === 'string') return r.split(',').map((code) => code.trim()) // handle string items with commas too
					return []
				})
			}

			// Fetch role details from DB
			const userRoleExtensions = await db
				.collection('userRoleExtension')
				.find({ code: { $in: roleCodes } })
				.toArray()

			roles = userRoleExtensions.length
				? userRoleExtensions.map((role) => ({
						_id: role._id.toString(),
						value: role.userRoleId,
						label: role.title,
						code: role.code,
				  }))
				: []
		}

		// Process entityType and entities
		let entityTypeIds = []
		let entityIds = []

		if (scope.entityType) {
			entityTypeIds = Array.isArray(scope.entityType) ? scope.entityType : [scope.entityType]
			if (scope.entities) {
				entityIds = scope.entities
			} else {
				entityTypeIds.forEach((et) => {
					if (scope[et]) entityIds.push(...scope[et].flat())
				})
			}
		}

		entityIds = entityIds.length ? entityIds.map((id) => ObjectId(id)) : []

		// Fetch entities and entityTypes
		const [entities, entityTypes] = await Promise.all([
			db
				.collection('entities')
				.find({ _id: { $in: entityIds } })
				.toArray(),
			db
				.collection('entityTypes')
				.find({ name: { $in: entityTypeIds } })
				.toArray(),
		])

		// Map entities under each entityType
		const entityMap = {}
		for (const entityType of entityTypeIds) {
			entityMap[entityType] = entities
				.filter((e) => e.entityType === entityType)
				.map((entity) => ({
					_id: entity._id,
					externalId: entity.registryDetails?.code || entity.metaInformation?.externalId,
					name: entity.metaInformation?.name,
					entityType: entity.entityType,
				}))
		}

		// Handle highest hierarchy
		const highestHierarchy = process.env.HIGHEST_IN_ENTITY_HIERARCHY
		async function findHighestEntity(entity) {
			return await db.collection('entities').findOne({
				[`groups.${entity.entityType}`]: { $in: [ObjectId(entity._id)] },
				entityType: highestHierarchy,
			})
		}

		// Build targeting criteria
		for (const entityType of entityTypeIds) {
			const matchingEntityType = entityTypes.find((et) => et.name === entityType)
			if (!matchingEntityType) continue

			let highestEntitiesMap = {}
			let finalRoles = [...roles] // By default, assign all roles

			// Handle elevate-project targeted roles logic
			if (process.env.CONSUMPTION_SERVICE === 'elevate-project') {
				let targetedRolesSet = new Set()

				// Find highest entities and targeted roles
				for (const entity of entityMap[entityType]) {
					const highestEntity = await findHighestEntity(entity)
					if (highestEntity) {
						highestEntitiesMap[highestEntity._id] = {
							_id: highestEntity._id,
							name: highestEntity.metaInformation?.name,
							externalId:
								highestEntity.registryDetails?.code || highestEntity.metaInformation?.externalId,
						}

						const targetedRolesResponse = await targetedRoles(highestEntity._id, entity.entityType, db)
						let targetedRolesData = targetedRolesResponse?.targetedRoles || []

						// Collect targeted role codes
						targetedRolesData.forEach((role) => targetedRolesSet.add(role.code))
					}
				}

				// Filter roles that match targeted roles
				if (targetedRolesSet.size > 0) {
					const targetedRolesArray = Array.from(targetedRolesSet)
					const filteredRoles = roles.filter((r) => targetedRolesArray.includes(r.code))
					if (filteredRoles.length > 0) {
						finalRoles = filteredRoles
					}
				}
			}

			// Assemble targeting object
			let finalTargeting = {
				entity_targeting: {
					_id: matchingEntityType._id,
					value: matchingEntityType.name,
					name: matchingEntityType.name,
				},
				roles: finalRoles,
				[entityType]: entityMap[entityType],
			}

			// Attach highest hierarchy if found
			if (Object.keys(highestEntitiesMap).length > 0) {
				finalTargeting[highestHierarchy] = Object.values(highestEntitiesMap)
			}

			// Add to final targeting criteria
			targetingCriteria.push(finalTargeting)
		}

		// Handle roles-only case
		if (roles.length > 0 && entityTypeIds.length === 0) {
			targetingCriteria.push({ roles })
		}

		return { success: true, result: targetingCriteria }
	} catch (error) {
		console.error('Error in generateTargetingCriteria:', error)
		return { success: false, error: error.message }
	}
}

/**
 * Checks if the scope object contains at least one valid ObjectId or UUID.
 * @param {Object} scope - The scope object to check.
 * @returns {boolean} - Returns true if at least one valid ObjectId or UUID is found, otherwise false.
 */
function hasValidTargetingData(scope) {
	for (const key in scope) {
		const value = scope[key]

		if (typeof value === 'string' && migrationUtils.isValidObjectIdOrUUID(value)) {
			return true
		}

		if (Array.isArray(value)) {
			if (value.some((item) => typeof item === 'string' && migrationUtils.isValidObjectIdOrUUID(item))) {
				return true
			}
		}

		// If value itself is an object and might contain IDs (optional enhancement)
		if (typeof value === 'object' && value !== null) {
			for (const innerKey in value) {
				const innerValue = value[innerKey]
				if (typeof innerValue === 'string' && migrationUtils.isValidObjectIdOrUUID(innerValue)) {
					return true
				}
				if (Array.isArray(innerValue)) {
					if (
						innerValue.some(
							(item) => typeof item === 'string' && migrationUtils.isValidObjectIdOrUUID(item)
						)
					) {
						return true
					}
				}
			}
		}
	}
	return false
}

/**
 * Checks if a certificate base template exists for a given code and type.
 * @param {string} code - Certificate base template code.
 * @param {string} type - Resource type (e.g., 'project').
 * @returns {Promise<Object>} - An object with success status and certificate base template data if found.
 */
async function isCertificateBaseTemplateExist(code, type) {
	try {
		let certificateBaseTemplate = await certificateBaseTemplateQueries.findOne({
			code: code,
			resource_type: type,
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
 * Fetches or creates a certificate template and its base template in SCP.
 * @param {Object} solution - Object containing certificateTemplateId.
 * @param {Object} projectTemplate - Project template object for reference.
 * @param {Object} db - Database instance to query templates.
 * @returns {Promise<Object>} - Returns an object with SCP certificate base template,
 * @throws {Error} If any required template is missing or creation fails.
 */
async function handleCertificateTemplate(solution, projectTemplate, db) {
	try {
		let result = {
			success: true,
			scpCertificateBaseTemplate: {},
			certificateTemplate: {},
			certificateBaseTemplate: {},
		}

		// Validate certificateTemplateId
		if (!solution?.certificateTemplateId) {
			throw new Error('certificateTemplateId not found in solution')
		}

		// Get the certificate template
		let certificateTemplate = await db.collection('certificateTemplates').findOne({
			_id: solution.certificateTemplateId,
		})

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

		const certificateTemplateInSCP = await isCertificateBaseTemplateExist(certificateBaseTemplate.code, 'project')
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
			const getSignedUrl = await fileService.getSignedUrl(payloadData, 'BASE_TEMPLATE', 'system', false)
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
				organization_id: utils.convertToString(process.env.DEFAULT_ORG_ID),
				resource_type: common.PROJECT,
				created_by: common.CREATED_BY_SYSTEM,
				created_at: new Date(),
				updated_at: new Date(),
				meta: templatesvgRes.certificateMeta, // Attach extracted meta info (logos, signatures)
			}

			// Save certificate template record in DB
			const certificateCreateRes = await certificateQueries.create(certificateData)

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
		console.error('Error creating or fetching certificate template:', error.message)
		return {
			success: false,
			error,
		}
	}
}

/**
 * Updates the resource
 * @param {string} projectId - The unique identifier of the resource to update.
 * @param {Object} solution - The solution object containing optional start and end dates.
 * @param {Object} updateData - The date to be updated
 * @returns {Promise<Object>} - Returns a promise that resolves to the updated resource object.
 * @throws {Error} Throws an error if the update operation fails.
 */
async function updateResource(resourceId, updateData) {
	try {
		let result = {
			success: true,
			updatedResource: null,
		}
		const updateOptions = {
			returning: true,
			raw: true,
		}

		const updatedResource = await resourceQueries.updateOne({ id: resourceId }, updateData, updateOptions)
		result.updatedResource = updatedResource
		return result
	} catch (error) {
		console.error('Error updating resource:', error)
		return { success: false, error }
	}
}

/**
 * Fetches targeted roles based on entityId and optional type filter.
 * @param {Array|string} entityId - Single or multiple entity IDs to fetch data for.
 * @param {string} type - Optional entity type to filter higher hierarchy paths.
 * @param {Object} db - MongoDB database connection object.
 * @returns {Object} - Object containing success status and targeted roles.
 */
async function targetedRoles(entityId, type, db) {
	try {
		let result = {
			success: true,
			targetedRoles: [],
		}

		// Retrieve entityDetails based on provided entity IDs
		const entityDetails = await db
			.collection('entities')
			.find(
				{ _id: { $in: Array.isArray(entityId) ? entityId : [entityId] } },
				{ projection: { childHierarchyPath: 1, entityType: 1 } }
			)
			.toArray()

		if (
			!entityDetails ||
			!entityDetails[0]?.childHierarchyPath ||
			entityDetails[0]?.childHierarchyPath.length < 0
		) {
			throw 'Entity not found'
		}

		// Extract the childHierarchyPath and entityType
		const { childHierarchyPath, entityType } = entityDetails[0]

		// Append entityType to childHierarchyPath array
		const updatedChildHierarchyPaths = [entityType, ...childHierarchyPath]

		// Filter for higher entity types if a specific type is requested
		let filteredHierarchyPaths = updatedChildHierarchyPaths
		if (type) {
			const typeIndex = updatedChildHierarchyPaths.indexOf(type)
			if (typeIndex > -1) {
				// Include only higher types in the hierarchy
				filteredHierarchyPaths = updatedChildHierarchyPaths.slice(0, typeIndex + 1)
			}
		}

		// Retrieve entity type IDs based on child hierarchy paths
		const fetchEntityTypeId = await db
			.collection('entityTypes')
			.find(
				{
					name: {
						$in: filteredHierarchyPaths,
					},
					isDeleted: false,
				},
				{ projection: { _id: 1 } }
			)
			.toArray()

		// Check if entity type IDs are retrieved successfully
		if (fetchEntityTypeId.length < 0) {
			throw 'Entity type not found'
		}

		// Extract the _id fields from the fetched entity types to use as a filter for user roles
		const userRoleFilter = fetchEntityTypeId.map((entityType) => entityType._id)

		const fetchUserRoles = await db
			.collection('userRoleExtension')
			.find(
				{
					'entityTypes.entityTypeId': {
						$in: userRoleFilter,
					},
					status: 'active',
				},
				{ projection: { _id: 1, title: 1, code: 1, userRoleId: 1 } }
			)
			.toArray()
		// Transforming the data
		const transformedData = fetchUserRoles.map((item) => {
			// For each item in the result array, create a new object with modified keys
			return {
				_id: item._id,
				value: item.userRoleId,
				label: item.title,
				code: item.code,
			}
		})

		result.targetedRoles = transformedData
		return result
	} catch (error) {
		console.error('Error updating resource:', error)
		return { success: false, error }
	}
}

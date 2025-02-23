/**
 * name : migrateProgramsAndSolutions.js
 * author : Priyanka Pradeep
 * created-date : 18-Feb-2025
 * Description : script to create the program from consumption side.
 */

require('module-alias/register')
require('dotenv').config({ path: '../../.env' })
// require('dotenv').config({ path: '/home/dell/workspace/SCP/survey-project-creation-service/src/.env' })

require('../../configs/events')()
const utils = require('./utils')
const path = require('path')
const createCsvWriter = require('csv-writer').createObjectCsvWriter
const entityTypeService = require('@services/entity-types')
const projectService = require('@services/projects')
const entityService = require('@services/entities')
const resourceService = require('@services/resource')
const resourceQueries = require('@database/queries/resources')
const certificateBaseTemplateQueries = require('@database/queries/certificateBaseTemplate')
const programService = require('@services/programs')
const rolloutService = require('@services/rollouts')
const programResourceMappingQueries = require('@database/queries/programResourceMapping')
const _ = require('lodash')
const MongoClient = require('mongodb').MongoClient
const { v4: uuidv4 } = require('uuid')
const userRequest = require('@requests/user')
const ObjectId = require('mongodb').ObjectID

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
				// _id: ObjectId('66c4a815c753c2fe12efc9d2'),
				status: 'active',
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
			// .limit(1)
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
			//p
			for (const program of programs) {
				let programIdStr = program._id.toString()
				console.log(`Processing program ${programIdStr}`)

				// Check if the program exists
				const isProgramExist = await checkResourceExist(programIdStr, 'program')
				if (isProgramExist.success) {
					console.log(`Program Exist for template ${programIdStr}`)
					csvRecords.push({
						programId: programIdStr,
						solutionId: '',
						type: 'program',
						success: 'Program Exist',
						resourceId: isProgramExist.resourceId,
						rolloutId: '',
					})
					continue
				}

				//convert the program components into array of object id
				const solutionMongoIds = program.components.map((stringId) => new ObjectId(stringId))

				// get all the solutions
				const solutions = await db
					.collection('solutions')
					.find({
						_id: { $in: solutionMongoIds },
						// _id: ObjectId('66c72d20c8fb762949bd734e'),
						type: 'improvementProject',
					})
					.limit(1)
					.toArray()

				if (solutions.length <= 0) {
					console.log(`No project solution found ${programIdStr}`)
					csvRecords.push({
						programId: programIdStr,
						solutionId: '',
						type: 'program',
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
					// if any project template is there then follow the migrate project flow
					// find the project templates
					if (solution?.projectTemplateId) {
						let projectTemplateIdStr = solution.projectTemplateId.toString()
						//find the project
						const isProjectExist = await checkResourceExist(projectTemplateIdStr, 'project')
						if (isProjectExist.success) {
							console.log(`Project Resource Exist for template ${projectTemplateIdStr}`)
							validSolutionIds.push(isProjectExist.resourceId)
							solutionTargetingMap[solutionIdStr] = {
								projectResourceId: isProjectExist.resourceId,
								scope: solution.scope,
								projectTemplateId: projectTemplateIdStr,
							}
						} else {
							console.log(`Project Resource Not Exist for template ${projectTemplateIdStr}`)
							//create project template part
							const projectTemplate = await db
								.collection('projectTemplates')
								.findOne({ _id: ObjectId(projectTemplateIdStr) })

							//validate the project template
							if (!projectTemplate?._id) {
								console.log(`No project template found for solution id ${solutionIdStr}, `)
								csvRecords.push({
									programId: programIdStr,
									solutionId: solutionIdStr,
									type: 'solution',
									success: 'No project template found',
									resourceId: '',
									rolloutId: '',
								})
								continue
							}

							//get task of the project template
							if (!Array.isArray(projectTemplate.tasks) || !projectTemplate.tasks.length > 0) {
								console.log(`No Task Found for Project Template ${solutionIdStr}, `)
								csvRecords.push({
									programId: programIdStr,
									solutionId: solutionIdStr,
									type: 'solution',
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

							//Validate the template task
							if (!templateTasks.length > 0) {
								console.log(`No Task Found for Project Template ${solutionIdStr}, `)
								csvRecords.push({
									programId: programIdStr,
									solutionId: solutionIdStr,
									type: 'solution',
									success: 'No project template found',
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

							//Add start date, end date and scope from solution
							projectTemplate.meta = {
								start_date: solution.startDate || null,
								end_date: solution.endDate || null,
							}
							projectTemplate.scope = solution.scope

							// Convert template
							let convertedTemplate = await convertProjectTemplate(
								projectTemplate,
								userOrgMap,
								DEFAULT_USER_ID
							)
							//send failure
							if (!convertedTemplate.success) {
								throw new Error(convertedTemplate.error)
							}
							convertedTemplate = convertedTemplate.template
							convertedTemplate.targeting_criteria = []

							// Find non-existing entities sequentially
							for (const key of entityKeys) {
								let values = convertedTemplate[key]
								if (Array.isArray(values) && values.length > 0) {
									values = [...new Set(values)]
									convertedTemplate[key] = utils.formatValues(values)

									await filterNonExistingEntities(key, values, entityTypeEntityMap, entitiesToCreate)
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
									type: 'solution',
									success: 'Project resource creation failed',
									resourceId: '',
									rolloutId: '',
								})
								continue
							}

							//update project template
							await resourceQueries.updateOne(
								{
									id: projectCreateResponse.projectId,
								},
								{
									meta: {
										start_date: solution.startDate || null,
										end_date: solution.endDate || null,
									},
									is_reusable: false,
								},
								{
									returning: true,
									raw: true,
								}
							)

							validSolutionIds.push(projectCreateResponse.projectId)
							solutionTargetingMap[solutionIdStr] = {
								projectResourceId: projectCreateResponse.resourceId,
								scope: solution.scope,
								projectTemplateId: projectTemplate._id.toString(),
							}
						}
						//if atleast one valid solution is there then create the program
						if (!validSolutionIds.length > 0) {
							csvRecords.push({
								programId: programIdStr,
								solutionId: '',
								type: 'program',
								success: 'No solution found',
								resourceId: '',
								rolloutId: '',
							})
							continue
						}

						let convertedProgramTemplate = await convertProgramTemplate(
							program,
							userOrgMap,
							DEFAULT_USER_ID
						)
						//validate the program template
						if (!convertedProgramTemplate.success) {
							throw new Error(convertedProgramTemplate.error)
						}
						convertedProgramTemplate = convertedProgramTemplate.template

						//create program
						const programCreationResponse = await createProgram(
							programIdStr,
							convertedProgramTemplate,
							convertedProgramTemplate.created_by,
							convertedProgramTemplate.organization_id,
							validSolutionIds
						)

						if (!programCreationResponse.success) {
							console.log(`Failed to create program ${programIdStr}`)
							csvRecords.push({
								programId: programIdStr,
								solutionId: '',
								type: 'program',
								success: 'Failed to create program',
								resourceId: '',
								rolloutId: '',
							})
							continue
						}

						let programResourceId = programCreationResponse.programId

						// get the program details
						let programDetail = await programService.details(
							programResourceId,
							convertedProgramTemplate.organization_id
						)

						//validate the program details
						if (programDetail.statusCode !== 200) {
							throw new Error(programDetail.error)
						}

						programDetail = programDetail.result

						//Format the program for rollout program creation
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

						//create program rollout
						const createProgramRolloutResponse = await rolloutService.create(
							convertedProgramRolloutTemplate,
							convertedProgramRolloutTemplate.created_by,
							convertedProgramRolloutTemplate.organization_id,
							false
						)

						//Validate the program rollout creation
						if (createProgramRolloutResponse.statusCode != 200) {
							throw new Error(createProgramRolloutResponse.error)
						}

						let programRolloutId = createProgramRolloutResponse.result.id

						for (let solutionData of programDetail.resources) {
							//Format the solution for rollout solution creation
							let convertSolutionRolloutTemplate = _.omit(solutionData, [
								'id',
								'status',
								'stage',
								'next_stage',
								'review_type',
								'reference_id',
								'created_at',
								'updated_at',
								'updated_by',
								'submitted_on',
								'published_on',
								'last_reviewed_on',
								'is_under_edit',
							])

							convertSolutionRolloutTemplate.parent_id = programRolloutId
							convertSolutionRolloutTemplate.resource_id = solutionData.id
							convertSolutionRolloutTemplate.start_date = solutionData?.meta?.start_date || null
							convertSolutionRolloutTemplate.end_date = solutionData?.meta?.end_date || null

							//create the solution rollout
							const createSolutionRolloutResponse = await rolloutService.create(
								convertSolutionRolloutTemplate,
								convertSolutionRolloutTemplate.created_by,
								convertSolutionRolloutTemplate.organization_id,
								true
							)

							// Validate the solution rollout creation
							if (createSolutionRolloutResponse.statusCode != 200) {
								throw new Error(createSolutionRolloutResponse.error)
							}

							//update the solution rollout status
							await rolloutService.publishCallback(
								createSolutionRolloutResponse.result.id,
								solutionIdStr,
								solutionTargetingMap[solutionIdStr].projectTemplateId
							)

							csvRecords.push({
								programId: programIdStr,
								solutionId: solutionIdStr,
								type: 'solution',
								success: 'Success',
								resourceId: solutionData.id,
								rolloutId: createSolutionRolloutResponse.result.id,
							})
						}

						//update the program rollout status
						await rolloutService.publishCallback(programRolloutId, programIdStr)

						csvRecords.push({
							programId: programIdStr,
							solutionId: solutionIdStr,
							type: 'program',
							success: 'Success',
							resourceId: programDetail.id,
							rolloutId: programRolloutId,
						})
					} else {
						//skip the solution
						console.log(`No project template found for solution id ${solutionIdStr}, `)
						csvRecords.push({
							programId: programIdStr,
							solutionId: solutionIdStr,
							type: 'solution',
							success: 'No project template found',
							resourceId: '',
							rolloutId: '',
						})
						continue
					}
				}
			}
		}
		// Write data to csv
		await csvWriter.writeRecords(csvRecords)
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

async function convertProjectTemplate(template, userOrgMap, DEFAULT_USER_ID) {
	try {
		let userId = DEFAULT_USER_ID
		let orgId = process.env.DEFAULT_ORG_ID
		if (userOrgMap[template.createdBy]) {
			userId = template.createdBy
			orgId = userOrgMap[template.createdBy].organization.id
		}

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
			learning_resources: Array.isArray(task.learningResources)
				? utils.convertResources(task.learningResources)
				: [],
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
			recommended_duration: utils.convertDuration(template.duration || template.metaInformation.duration),
			keywords: utils.convertKeywords(template.keywords),
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
				? utils.convertResources(template.learningResources)
				: [],
			licenses: 'cc_by_4.0',
			created_by: userId.toString(),
			organization_id: orgId.toString(),
			published_id: template._id,
			tasks: template.taskDetails ? template.taskDetails.map(convertTask) : [],
		}

		return { success: true, template: convertedTemplate }
	} catch (error) {
		console.error('Error occurred while converting the template:', error)
		return { success: false, error }
	}
}

//to get all entities which is not present
async function filterNonExistingEntities(entityTypeKey, values, entityTypeEntityMap, entitiesToCreate) {
	if (entityTypeEntityMap.hasOwnProperty(entityTypeKey)) {
		const entityTypeId = entityTypeEntityMap[entityTypeKey].entity_type_id
		const existingEntities = new Set(entityTypeEntityMap[entityTypeKey].entities)
		// Filter and push non-existing values in one step
		values.forEach((value) => {
			// Check if the value already exists in entitiesToCreate with the same entity_type_id
			const alreadyExists = entitiesToCreate.some(
				(entity) => entity.entity_type_id == entityTypeId && entity.value == utils.formatEntityValue(value)
			)

			// If the value is not present in existingEntities and not already in entitiesToCreate
			if (value && !existingEntities.has(utils.formatEntityValue(value)) && !alreadyExists) {
				entitiesToCreate.push({
					entity_type_id: entityTypeId,
					value: utils.formatEntityValue(value),
					label: utils.formatTitle(value),
				})
			}
		})
	}

	return entitiesToCreate
}

// function to create project and entities
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

						console.log(entitiesToCreate, 'entitiesToCreate after creation')
						console.log(entityTypeEntityMap, 'entityTypeEntityMap after entity creation')

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
			keywords: utils.convertKeywords(template.keywords),
			licenses: 'cc_by_4.0',
			resources: [],
		}

		return { success: true, template: convertedTemplate }
	} catch (error) {
		console.error('Error occurred while converting the program template:', error)
		return { success: false, error }
	}
}

// function to create program
async function createProgram(programId, programData, userId, orgId, solutionIds) {
	try {
		// Logic to create the program
		const createProgram = await programService.create(programData, userId, orgId)
		if (!createProgram?.result?.id) {
			throw new Error('Failed to create program')
		}

		//add resource to program
		for (let solutionId of solutionIds) {
			await programResourceMappingQueries.create({
				program_id: createProgram.result.id,
				resource_id: solutionId,
				organization_id: orgId,
			})
		}

		const updateProgram = await resourceService.publishCallback(createProgram.result.id, programId.toString())
		if (updateProgram.statusCode != 202) {
			throw new Error('Failed to update ptogram')
		}

		return { success: true, programId: createProgram.result.id }
	} catch (error) {
		console.log('Failed to create project ', programId)
		return { success: false, error }
	}
}

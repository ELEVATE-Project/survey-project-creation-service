/**
 * name : sunbird.js
 * author : Priyanka Pradeep
 * Date : 13-Dec-2024
 * Description : Create data in sunbird service.
 */
const { projectsMongoDBUrl, surveyMongoDBUrl } = require('@consumption/config')
const common = require('@constants/common')
const MongoDBConnection = require('@configs/mongoConnection')
const resourceService = require('@services/resource')
const rolloutService = require('@services/rollouts')
const projectService = require('@services/projects')
const rolloutQueries = require('@database/queries/rollouts')
const certificateBaseTemplateQueries = require('@database/queries/certificateBaseTemplate')
const utils = require('@generics/utils')
const interfaceBaseUrl = process.env.INTERFACE_SERVICE_HOST
const requests = require('@generics/requests')
const endpoints = require('@constants/endpoints')
const { ObjectId } = require('mongodb')
const axios = require('axios')
const cheerio = require('cheerio')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const targetingHelpers = require('@helpers/targetingCriteria')
let socketInUse = false // Flag to track socket status
let projectsMongoConnection = null
const { Op } = require('sequelize')
// Project template DTO (transformer)
const ProjectTemplateDTO = require('@consumptionDTOs/sunbird/project')
// User program mapping DTO (attached to project DTO file)
const UserProgramMappingDTO = ProjectTemplateDTO.userProgramMapping

// Adapter objects to match the DTO shape used in elevate.js
const projectDTO = {
	formatProjectTemplateDTO: async (projectData) => {
		try {
			const formatted = await ProjectTemplateDTO.transform(projectData)
			if (!formatted || !formatted.success) return { success: false, error: formatted?.error }
			return { success: true, data: formatted.template }
		} catch (err) {
			return { success: false, error: err.message || err }
		}
	},
	assignSequenceNumbers: (...args) => assignSequenceNumbers(...args),
}

const programDTO = {
	formatProgramTemplateDTO: async (programData, scopeKeysArg) => {
		try {
			const formatted = await formatProgramTemplate(programData)
			if (!formatted || !formatted.success) return { success: false, error: formatted?.error }
			return { success: true, data: formatted.programDocument }
		} catch (err) {
			return { success: false, error: err.message || err }
		}
	},
	orderSolutionsInProgram: (...args) => orderSolutionsInProgram(...args),
}

/**
 * To connect with the mongoDB with the given url
 * @name connectMongo
 * @param {Object} url - mongo url as returned from config
 * @returns {Object} - Connection Object
 */
let mongoConnection = null
const connectMongo = async (url) => {
	try {
		mongoConnection = new MongoDBConnection(url)
		await mongoConnection.connect()
		// Get the database instance
		return mongoConnection.getDb()
	} catch (error) {
		throw new Error('Error in mongo connection.')
	}
}

if (process.env.CONSUMPTION_SERVICE != common.CONSUMPTION_SERVICE_SELF) {
	if (!projectsMongoDBUrl) {
		throw new Error('PROJECTS_MONGODB_URL is not set in the environment variables.')
	}

	;(async () => {
		// Connect to the database
		projectsMongoConnection = await connectMongo(projectsMongoDBUrl)
		// Optionally assign mongoDb for legacy code
		mongoDb = projectsMongoConnection
	})()
}

// Define the mongoDb collection names used
const COLLECTIONS = {
	CATEGORIES: 'projectCategories',
	TEMPLATES: 'projectTemplates',
	TASKS: 'projectTemplateTasks',
	USER_ROLES: 'userRoles',
	USER_EXTENSIONS: 'userExtension',
	PROGRAMS: 'programs',
	SOLUTIONS: 'solutions',
	CERTIFICATE_TEMPLATE: 'certificateTemplates',
	CERTIFICATE_BASE_TEMPLATE: 'certificateBaseTemplates',
}

/**
 * Publish the project template
 * @name publishProjectTemplates
 * @param {Object} templateData - Project template data
 * @returns {Object} - Response of template creation
 */
const publishProjectTemplates = function (templateData) {
	return new Promise(async (resolve, reject) => {
		const result = { success: false, templateId: null, error: null }
		try {
			// fetch project details
			let projectData = await projectService.details(
				templateData.id,
				templateData.organization_code,
				templateData.tenant_code
			)

			projectData = projectData?.result || {}

			if (Object.keys(projectData).length <= 0) {
				throw new Error('FAILED_TO_FETCH_PROJECT')
			}
			// Format the template using DTO transformer (adapter to elevate-style DTO)
			const formattedTemplate = await projectDTO.formatProjectTemplateDTO(projectData)
			if (!formattedTemplate || !formattedTemplate.success || Object.keys(formattedTemplate.data).length == 0) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.data

			//add duration key if consumption service is sunbird
			if (projectData.recommended_duration) {
				template.duration = utils.convertDuration(projectData.recommended_duration)
			}

			// Process Categories
			if (projectData.categories?.length > 0) {
				let categoriesResponse = await processCategories(projectData.categories)
				if (!categoriesResponse.success) {
					throw new Error('FAILED_TO_FETCH_OR_CREATE_CATEGORIES')
				}
				template.categories = categoriesResponse.categories
			}

			//process recommededFor
			if (projectData.recommended_for?.length > 0) {
				let recommededForResponse = await convertRecommendedRolesForProjects(projectData.recommended_for)
				if (!recommededForResponse.success) {
					throw new Error('FAILED_TO_FETCH_RECOMMENDED_FOR')
				}
				template.recommendedFor = recommededForResponse?.recommendedRoles
			}

			// ensure mongo connection (lazy init similar to elevate.js)
			projectsMongoConnection = projectsMongoConnection
				? projectsMongoConnection
				: await connectMongo(projectsMongoDBUrl)
			// Insert the template into the database
			const templateCollection = projectsMongoConnection.collection(COLLECTIONS.TEMPLATES)
			const result = await templateCollection.insertOne(template)

			// Validate the result of the template creation
			if (!result || !result.insertedId) {
				throw new Error('FAILED_TO_CREATE_TEMPLATE')
			}

			const templateId = result.insertedId

			// Process and Create Tasks
			const processedTasks = projectDTO.assignSequenceNumbers(projectData.tasks || [])
			const taskCreationResponse = await createTasks(
				processedTasks,
				templateId,
				template.externalId,
				null,
				templateData.userToken
			)

			// Validate the result of the task creation
			if (!taskCreationResponse.success) {
				throw new Error('FAILED_TO_CREATE_TASKS')
			}

			// Update Template with tasks and sequence
			await templateCollection.updateOne(
				{ _id: templateId },
				{
					$set: {
						tasks: taskCreationResponse.taskIds,
						taskSequence: taskCreationResponse.externalIds,
					},
				}
			)

			//update the published id in resource table
			await resourceService.publishCallback(templateData.id, templateId.toString(), templateData.tenant_code)

			//return result
			result.success = true
			result.templateId = templateId
			return resolve(result)
		} catch (error) {
			result.error = error.message || error
			return reject(error)
		}
	})
}

/**
 * Create and Find Categories
 * @name processCategories
 * @param {Object} categories - Categories Data
 * @returns {Object} - Response contains categories data
 */
async function processCategories(categories) {
	try {
		// ensure mongo connection (lazy init similar to elevate.js)
		projectsMongoConnection = projectsMongoConnection
			? projectsMongoConnection
			: await connectMongo(projectsMongoDBUrl)
		const categoriesCollection = projectsMongoConnection.collection(COLLECTIONS.CATEGORIES)

		// Format categories
		const formattedCategories = categories.map((category) => {
			if (!category.label || !category.value) {
				throw new Error('EACH_CATEGORY_MUST_BE_LABEL_AND_VALUE')
			}
			return {
				label: category.label,
				value: category.value,
				formattedName: utils.formatToTitleCase(category.value),
				externalId: category.value.replace(/_/g, '').toLowerCase(),
			}
		})

		// Fetch existing categories by externalId
		let existingCategories = []
		const externalIds = formattedCategories.map((cat) => cat.externalId)
		if (externalIds.length > 0) {
			existingCategories = await categoriesCollection.find({ externalId: { $in: externalIds } }).toArray()
		}

		const existingExternalIds = existingCategories.map((cat) => cat.externalId)

		// Filter out categories that already exist
		const newCategories = formattedCategories
			.filter((cat) => !existingExternalIds.includes(cat.externalId))
			.map(({ formattedName, externalId, label }) => ({
				createdBy: 'SYSTEM',
				updatedBy: 'SYSTEM',
				isDeleted: false,
				isVisible: true,
				status: 'active',
				icon: '',
				noOfProjects: 0,
				name: formattedName,
				externalId: externalId,
				label: label,
				createdAt: new Date(),
				updatedAt: new Date(),
			}))

		// Insert only new categories
		if (newCategories.length > 0) {
			const { insertedIds } = await categoriesCollection.insertMany(newCategories)
			newCategories.forEach((category, index) => {
				category._id = insertedIds[index]
				existingExternalIds.add(category.externalId)
			})
		}

		// Create a lookup object for existing and new categories
		const categoryLookup = {}

		// Populate lookup with existing categories
		existingCategories.forEach((cat) => {
			categoryLookup[cat.externalId] = cat
		})

		// Add new categories to the lookup (overwrite if already exists)
		newCategories.forEach((cat) => {
			categoryLookup[cat.externalId] = cat
		})

		// Map formatted categories to the processed result using the lookup object
		const processedCategories = formattedCategories.map((category) => {
			const cat = categoryLookup[category.externalId]
			return {
				_id: cat._id,
				externalId: cat.externalId,
				name: cat.name,
			}
		})

		return { success: true, categories: processedCategories }
	} catch (error) {
		console.error('Error in processCategories:', error.message)
		return { success: false, error: `Failed to process categories: ${error.message}` }
	}
}

/**
 * Create Task
 * @name createTasks
 * @param {Object} tasks - task data
 * @param {String} templateId - template Id
 * @param {String} templateExternalId - template externaldId
 * @param {String} parentId - parentId
 * @returns {Object} - Response contains task data
 */
async function createTasks(tasks, templateId, templateExternalId, parentId = null, userToken) {
	const result = { success: false, taskIds: [], externalIds: [], error: null }
	try {
		// ensure mongo connection (lazy init similar to elevate.js)
		projectsMongoConnection = projectsMongoConnection
			? projectsMongoConnection
			: await connectMongo(projectsMongoDBUrl)
		const taskCollection = projectsMongoConnection.collection(COLLECTIONS.TASKS)
		const taskIds = []
		const externalIds = []

		for (const task of tasks) {
			// Format the task data
			const taskData = {
				name: task.name,
				description: task.name,
				externalId: utils.generateExternalId(task.name),
				type: task.type,
				isDeleted: false,
				isDeletable: !task.is_mandatory,
				sequenceNumber: task.sequence_no,
				projectTemplateId: templateId,
				projectTemplateExternalId: templateExternalId,
				hasSubTasks: task.children?.length > 0,
				learningResources: utils.convertResources(task.learning_resources || []),
				parentId,
				deleted: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			if (task.type === common.OBSERVATION) {
				const childObsSolution = await processChildObservationSolution(
					task,
					templateId,
					templateExternalId,
					userToken
				)

				if (!childObsSolution.success || !childObsSolution?.solutionDetails) {
					throw new Error(`Failed to create child observation solution: ${childObsSolution.error}`)
				}

				taskData.solutionDetails = childObsSolution.solutionDetails
			}
			// Create the task
			const taskCreationRes = await taskCollection.insertOne(taskData)
			// Validate the insertion result
			if (!taskCreationRes || !taskCreationRes.insertedId) {
				throw new Error(`Failed to insert task: ${task.name}`)
			}

			const taskId = taskCreationRes.insertedId
			taskIds.push(taskId)
			externalIds.push(taskData.externalId)

			// Recursively handle child tasks
			if (task.children?.length) {
				const childTaskResult = await createTasks(
					task.children,
					templateId,
					templateExternalId,
					taskId,
					userToken
				)

				// Validate the child task creation
				if (!childTaskResult.success) {
					throw new Error(
						`Failed to create child tasks for task: ${task.name}. Error: ${childTaskResult.error}`
					)
				}

				taskIds.push(...childTaskResult.taskIds)

				// Update task with child task sequence and children
				await taskCollection.updateOne(
					{ _id: taskId },
					{ $set: { children: childTaskResult.taskIds, taskSequence: childTaskResult.externalIds } }
				)
			}
		}

		result.success = true
		result.taskIds = taskIds
		result.externalIds = externalIds
		return result
	} catch (error) {
		console.error('Error in createTasks:', error.message)
		result.error = `Failed to create tasks: ${error.message}`
		return result
	}
}

/**
 * Create child observation solution from parent reusable observation
 */
async function processChildObservationSolution(task, templateId, templateExternalId, userToken) {
	try {
		const solutionCollection = mongoDb.collection(COLLECTIONS.SOLUTIONS)

		// Step 1: Fetch parent solution to get externalId and entityType
		const parentSolution = await solutionCollection.findOne({
			externalId: task.solution_details?.external_id,
			isReusable: true,
			type: common.OBSERVATION,
		})

		if (!parentSolution) {
			throw new Error(`Parent solution not found for external_id: ${task.solution_details?.external_id}`)
		}

		// Step 2: Build request URL for consumption service
		const queryParam = {
			solutionId: parentSolution.externalId,
			entityType: parentSolution.entityType,
		}

		const url = utils.buildUrl(process.env.INTERFACE_SERVICE_HOST, endpoints.IMPORT_FROM_SOLUTION, queryParam)

		const timestamp = utils.epochTime()

		// Step 3: Prepare payload for consumption service
		const payload = {
			programExternalId: templateExternalId,
			externalId: parentSolution.externalId + '-' + timestamp,
			name: parentSolution.name,
			description: parentSolution.description || '',
		}

		// Step 4: Call consumption service to create child solution
		const response = await requests.post(url, payload, userToken, true, common.INTERNAL_ACCESS_TOKEN)

		if (!response.success || !response.data) {
			throw new Error(`Error : ${response?.error || 'Child observation solution creation failed'}`)
		}

		const results = response.data?.result

		if (!results) {
			throw new Error(`Error: Consumption service did not return a result`)
		}

		// Step 5: Fetch created child solution from DB
		const childSolution = await solutionCollection.findOne({
			externalId: results.externalId,
			isReusable: false,
			type: common.OBSERVATION,
		})

		if (!childSolution) {
			throw new Error(`Child solution not found for external_id: ${results.externalId}`)
		}

		// Step 6: Return formatted solution details
		return {
			success: true,
			solutionDetails: {
				_id: childSolution._id,
				externalId: childSolution.externalId,
				type: common.OBSERVATION,
				name: childSolution.name,
				entityType: childSolution.entityType,
			},
		}
	} catch (error) {
		console.error('Error in processChildObservationSolution:', error.message)
		return { success: false, error: error.message }
	}
}

/**
 * Assign sequence number for task
 * @name assignSequenceNumbers
 * @returns {Object} - Response contains task object
 */
const assignSequenceNumbers = (tasks) => {
	/* Temporory fix start, because elevate-project doent have the observation capability in tasks now */
	// Filter out 'observation' type tasks
	const filteredTasks = tasks.filter((task) => task.type !== common.OBSERVATION)
	// Sort tasks based on their current sequence number (ascending order)
	filteredTasks.sort((a, b) => a.sequence_no - b.sequence_no)
	let sequenceCounter = 1
	return filteredTasks.map((task) => {
		task.sequence_no = sequenceCounter++ // Reassign sequence number
		return task
	})
	/* Temporory fix end */

	// let sequenceCounter = 1
	// return tasks.map((task) => {
	// 	if (!task.sequence_no) {
	// 		task.sequence_no = sequenceCounter++
	// 	}
	// 	return task
	// })
}

/**
 * Create Template and Tasks
 * @name publishProject
 * @param {Object} categories - Categories Data
 * @returns {Object} - Response contains categories data
 */
const publishProject = function (templateData) {
	return new Promise(async (resolve, reject) => {
		try {
			let apiUrl =
				interfaceBaseUrl + process.env.CONSUMPTION_SERVICE_BASE_URL + process.env.PROJECT_PUBLISH_END_POINT

			let bodyData = {
				data: templateData,
				callBackUrl:
					interfaceBaseUrl + process.env.APPLICATION_BASE_URL + endpoints.CALLBACK_URL_FOR_RESOURCE_PUBLISH,
			}
			const response = await requests.post(apiUrl, bodyData, '', true, common.INTERNAL_ACCESS_TOKEN)

			return resolve(response)
		} catch (error) {
			return reject(error)
		}
	})
}

/**
 * Converts the recommended roles for projects based on the consumption service type.
 * @name convertRecommendedRolesForProjects
 * @param {Array} recommendedFor - An array of objects containing label and value for recommended roles.
 * @returns {Object} The result object containing success status and recommended roles.
 */
async function convertRecommendedRolesForProjects(recommendedFor) {
	try {
		// If the user role is not present in the userRoles collection , the recommendedFor role will be skipped
		// as we don't know the entity of the role in that case to create.
		// ensure mongo connection (lazy init similar to elevate.js)
		projectsMongoConnection = projectsMongoConnection
			? projectsMongoConnection
			: await connectMongo(projectsMongoDBUrl)
		const userRoleCollection = projectsMongoConnection.collection(COLLECTIONS.USER_ROLES)
		const roles = await userRoleCollection.find({ status: 'active' }).toArray()

		// Prepare the recommended roles for the Sunbird project
		const recommendedRoles = recommendedFor
			.filter((item) => item?.label && item?.value)
			// Validate label and value exist
			.map((item) => {
				// Find the matching role for each item
				const matchingRole = roles.find((role) => role.title.trim() === item.label.trim())
				return matchingRole ? { roleId: matchingRole._id, code: matchingRole.code } : null
			})
			.filter((role) => role !== null) // Remove any null roles from the output

		return { success: true, recommendedRoles }
	} catch (error) {
		return { success: false, error: `Failed to process recommeded for: ${error.message}` }
	}
}

/**
 * Create solutions for resources
 * @name createSolutions
 * @param {Object} resourceDetails - Object of resource details
 * @param {Object} programDetails - Object of program details
 * @returns {Array} Array of objects of solutions
 */
const createSolutions = async (resourceDetails, programDetails, userToken) => {
	let result = {}
	try {
		// array to have objects of solutions to create
		let solutionsToCreate = []

		// solution to certificate mapping
		let solutionCertificateMap = []
		// solution to rollout if map
		let solutionRolloutMap = {}

		const endDate = new Date(programDetails?.end_date)
		const startDate = new Date(programDetails?.start_date)
		resourceDetails.forEach((resource) => {
			// create solutions template
			const solutionTemplate = {
				resourceType: [common.SOLUTIONS_RESOURCE_TYPE[resource.type]],
				language: resource?.languages ? resource?.languages.map((language) => language.label) : [],
				keywords: resource?.keywords ? utils.formatKeywords(resource?.keywords) : [],
				concepts: resource?.concepts ? resource?.concepts : [],
				themes: resource?.themes ? resource?.themes : [],
				flattenedThemes: resource?.flattenedThemes ? resource?.flattenedThemes : [],
				entities: resource?.entities ? resource?.entities : [],
				registry: resource?.registry ? resource?.registry : [],
				isRubricDriven: resource?.isRubricDriven ? true : false,
				scp_reference_id: resource?.resource_id,
				enableQuestionReadOut: resource?.enableQuestionReadOut ? true : false,
				captureGpsLocationAtQuestionLevel: resource?.captureGpsLocationAtQuestionLevel ? true : false,
				isAPrivateProgram: false,
				allowMultipleAssessemts: resource?.allowMultipleAssessemts ? true : false,
				isDeleted: false,
				pageHeading: 'Domains',
				minNoOfSubmissionsRequired: resource?.minNoOfSubmissionsRequired
					? resource?.minNoOfSubmissionsRequired
					: 1,
				rootOrganisations: resource?.organization
					? resource?.organization.map((organization) => organization.id)
					: [],
				createdFor: resource?.organization ? resource?.organization.map((organization) => organization.id) : [],
				deleted: false,
				name: resource?.title,
				programExternalId: programDetails.externalId,
				entityType: resource?.entityType ? resource?.entityType : null,
				type: common.SOLUTIONS_TYPE[resource.type] ? common.SOLUTIONS_TYPE[resource.type] : null,
				subType: common.SOLUTIONS_TYPE[resource.type] ? common.SOLUTIONS_TYPE[resource.type] : null,
				isReusable: false,
				externalId: utils.generateUniqueId(),
				programId: programDetails._id,
				programName: programDetails.name,
				programDescription: programDetails.description,
				description: resource?.description ? resource.description : programDetails.description,
				status: common.STATUS_ACTIVE.toLowerCase(),
				updatedAt: new Date(),
				createdAt: new Date(),
				scope: programDetails.scope,
				projectTemplateId: resource._id,
				updatedBy: programDetails.created_by,
				author: programDetails.created_by,
				endDate,
				startDate,
				creator: programDetails.created_by,
				orgId: programDetails.orgId,
				tenantId: programDetails.tenantId,
				referenceFrom: programDetails.referenceFrom ? programDetails.referenceFrom : '',
			}

			solutionRolloutMap[solutionTemplate.externalId] = resource.rolloutId

			// map resource externalId and certificate Data if it has certificate data
			if (
				resource?.certificate &&
				typeof resource?.certificate === common.OBJECT &&
				Object.keys(resource?.certificate).length != 0
			) {
				solutionCertificateMap.push({
					externalId: solutionTemplate.externalId,
					certificate: resource?.certificate,
				})
			}
			solutionsToCreate.push(solutionTemplate)
		})

		// ensure mongo connection (lazy init similar to elevate.js)
		projectsMongoConnection = projectsMongoConnection
			? projectsMongoConnection
			: await connectMongo(projectsMongoDBUrl)
		const solutionCollection = projectsMongoConnection.collection(COLLECTIONS.SOLUTIONS)
		await solutionCollection.insertMany(solutionsToCreate)
		let createdSolutions = await solutionCollection
			.find({
				programId: programDetails._id,
			})
			.toArray()

		// update solution links for deeplink
		let generatedLink = ''
		const solutionLinks = solutionsToCreate
			.map((solution) => {
				// Find the created solution corresponding to the externalId
				const createdSolutionDetails = createdSolutions.find(
					(solutionCreated) => solutionCreated.externalId == solution.externalId
				)

				if (createdSolutionDetails) {
					// Generate the link
					generatedLink = utils.md5Hash(`${createdSolutionDetails._id}###${createdSolutionDetails.author}`)

					// Update createdSolutions array outside of the map to avoid mutation
					createdSolutions = createdSolutions.map((item) => {
						if (item._id == createdSolutionDetails._id) {
							return {
								...item,
								link: generatedLink,
							}
						}
						return item // return unchanged item
					})

					// Return the _id and link for the solution
					return {
						_id: ObjectId(createdSolutionDetails._id),
						link: generatedLink,
					}
				}

				// Return a default or error object if createdSolutionDetails is not found
				return null
			})
			.filter((solution) => solution !== null) // Filter out any null values if not found

		// update the solutions collection with link
		await Promise.all(
			solutionLinks.map(async (solution) => {
				const updateSolution = await solutionCollection.updateOne(
					{
						_id: solution._id,
					},
					{
						$set: {
							link: solution?.link ? solution?.link : null,
						},
					}
				)
				// Validate the result of the solution updation
				if (!updateSolution) {
					throw new Error(`Failed to update link for solution ${solution._id}.`)
				}
			})
		)
		// ensure mongo connection (lazy init similar to elevate.js)
		projectsMongoConnection = projectsMongoConnection
			? projectsMongoConnection
			: await connectMongo(projectsMongoDBUrl)
		const projectTemplateCollection = projectsMongoConnection.collection(COLLECTIONS.TEMPLATES)

		const createdSolutionsResponse = await Promise.all(
			createdSolutions.map(async (solution) => {
				const updateProjectTemplate = await projectTemplateCollection.updateOne(
					{
						_id: solution.projectTemplateId,
					},
					{
						$set: {
							solutionId: solution._id,
							solutionExternalId: solution.externalId,
						},
					}
				)

				// Validate the result of the template updation
				if (!updateProjectTemplate) {
					throw new Error(
						`Failed to update the child project template with solution details into the ${COLLECTIONS.TEMPLATES} collection.`
					)
				}

				return {
					...solution,
					rolloutId: solutionRolloutMap[solution.externalId],
				}
			})
		)

		if (solutionCertificateMap && solutionCertificateMap.length > 0) {
			for (const solutionMap of solutionCertificateMap) {
				const targetSolution = createdSolutions.find(
					(solution) => String(solution.externalId).trim() === String(solutionMap.externalId).trim()
				)
				if (targetSolution) {
					await insertCertificateTemplate(
						solutionMap.certificate,
						targetSolution._id,
						programDetails._id,
						programDetails.created_by,
						userToken,
						programDetails.orgId,
						programDetails.tenantId
					)
				}
			}
		}

		result.success = true
		result.data = createdSolutionsResponse
		return result
	} catch (error) {
		console.log(error)
		result.success = false
		result.error = error
		return result
	}
}

/**
 * Create a duplicate solution from the given resource details
 * @name duplicateResources
 * @param {Object} resourceDetails - Object of resource details
 * @param {String} created_by - created by user id
 * @param {String} template -togetProgramInformation for project as a task
 * @returns {Array} Array of objects of duplicate templates
 */
const duplicateResources = async (resourceDetails, resourceCertificate = {}, programData, template) => {
	try {
		// initialise list of project templates to create
		let projectTemplateIds = []
		//initialise list of solution templates to create
		let solutionTemplateIds = []
		let certificate = resourceCertificate || {}
		//Getting program id for project as a task
		let programId = template?._id ? ObjectId(template?._id) : null

		if (certificate && Object.keys(certificate).length > 0) {
			// append task name in each task certificate criterias
			const certificateCriteriaConditions = Object.keys(certificate.criteria.conditions)
			certificateCriteriaConditions.forEach((criteriaId) => {
				Object.keys(certificate.criteria.conditions[criteriaId].conditions).forEach((eachCriteria) => {
					const foundTask = resourceDetails.tasks.find((eachTask) => eachTask.id == eachCriteria)
					if (foundTask) {
						certificate.criteria.conditions[criteriaId].conditions[eachCriteria].taskName = foundTask.name
					}
				})
			})
		}

		// seggregate templates based on type , all projects should be created in projectTemplates and others in solutions collection
		if (resourceDetails.type == common.PROJECT || resourceDetails.resource_type == common.PROJECT)
			projectTemplateIds.push(ObjectId(resourceDetails.published_id))
		else solutionTemplateIds.push(ObjectId(resourceDetails.published_id))

		// handling only project creation now. Make changes here for observation , survey etc...
		if (projectTemplateIds.length > 0) {
			// ensure mongo connection (lazy init similar to elevate.js)
			projectsMongoConnection = projectsMongoConnection
				? projectsMongoConnection
				: await connectMongo(projectsMongoDBUrl)
			const projectsCollection = projectsMongoConnection.collection(COLLECTIONS.TEMPLATES)
			const projectTemplates = await projectsCollection
				.find({
					_id: {
						$in: projectTemplateIds,
					},
				})
				.toArray()

			//templateProjectsTaskMap = {
			// 	projectExternalId : [ list of last ids]
			// }
			let templateProjectsTaskMap = {}
			//templateProjectsIdMap = {
			// resource_id: resource id in the resource table,
			// rollout_id: rollout id in the rollout table,
			// }
			let templateProjectsIdMap = {}
			// array of project templates to create
			let templateProjects = []
			// array of template tasks to create
			let templateTaskIds = []
			// array of created template tasks
			let duplicateTasks = []

			//taskMap = {
			// 	projectTaskId : duplicateProjectTaskId
			// }
			let taskMap = {}
			let taskSeqMap = {}
			const externalId_suffixing = `${Date.now()}${common.SUFFIX_CHILD}`

			if (projectTemplates.length > 0) {
				// create project duplicate template to create
				projectTemplates.forEach((project) => {
					project.externalId = project.externalId + externalId_suffixing
					taskSeqMap[project.externalId] = project.taskSequence
					project.tenantId = resourceDetails.tenant_code
					project.orgId = resourceDetails.organization_code
					delete project._id
					project.updatedAt = new Date()
					project.createdAt = new Date()
					project.createdBy = programData.userId
					project.updatedBy = programData.userId
					;(project.isReusable = false), (project.scp_reference_id = resourceDetails.resource_id)
					templateProjectsTaskMap[project.externalId] = project.tasks
					templateProjectsIdMap[project.externalId] = {
						resource_id: resourceDetails.resource_id,
						rollout_id: resourceDetails.id,
					}
					templateProjects.push(project)
				})
				// array of tasks to create
				Object.keys(templateProjectsTaskMap).forEach(async (projectExtId) => {
					templateTaskIds = [...templateTaskIds, ...templateProjectsTaskMap[projectExtId]]
				})
				templateTaskIds = [...new Set(templateTaskIds)]
				// ensure mongo connection (lazy init similar to elevate.js)
				projectsMongoConnection = projectsMongoConnection
					? projectsMongoConnection
					: await connectMongo(projectsMongoDBUrl)
				const projectsTaskCollection = projectsMongoConnection.collection(COLLECTIONS.TASKS)
				const projectsTasksDetails = await projectsTaskCollection
					.find({
						_id: {
							$in: templateTaskIds,
						},
					})
					.toArray()
				// duplicate project task details to create

				for (const [index, projectTask] of projectsTasksDetails.entries()) {
					let oldTaskExtId = projectTask.externalId
					projectTask.externalId = utils.generateUniqueId()
					// if task is part of certificate criteria , replace the old task name with new task name
					// this is required as task name is used to identify the task in certificate criteria
					// as task id will be different for each project created from the template
					if (certificate && Object.keys(certificate).length > 0) {
						const conditionsList = Object.keys(certificate.criteria.conditions)
						conditionsList.forEach((condition) => {
							Object.keys(certificate.criteria.conditions[condition].conditions).forEach(
								(subCondition) => {
									if (
										certificate.criteria.conditions[condition].conditions[subCondition].scope ==
											common.TASK &&
										certificate?.criteria?.conditions[condition].conditions[subCondition]
											?.taskName &&
										certificate?.criteria?.conditions[condition]?.conditions[
											subCondition
										]?.taskName.toLowerCase() == projectTask.name.toLowerCase()
									) {
										certificate.criteria.conditions[condition].conditions[projectTask.externalId] =
											_.omit(
												certificate.criteria.conditions[condition].conditions[subCondition],
												'taskName',
												'sequence_no'
											)
										delete certificate.criteria.conditions[condition].conditions[subCondition]
										certificate.criteria.conditions[condition].conditions[
											projectTask.externalId
										].taskDetails = [projectTask.externalId]
										certificate.criteria.conditions[condition].expression =
											certificate.criteria.conditions[condition].expression.replace(
												subCondition,
												projectTask.externalId
											)
									}
								}
							)
						})
					}
					// replace old task id by new task id in sequence
					_.update(taskSeqMap, projectTask.projectTemplateExternalId + externalId_suffixing, (tasks) =>
						tasks.map((task) => (task === oldTaskExtId ? projectTask.externalId : task))
					)
					taskMap[projectTask._id] = projectTask.externalId
					projectTask.updatedAt = new Date()
					projectTask.createdAt = new Date()
					projectTask.createdBy = programData.userId
					projectTask.updatedBy = programData.userId
					projectTask.projectTemplateExternalId = projectTask.projectTemplateExternalId + externalId_suffixing
					delete projectTask._id
					duplicateTasks.push(projectTask)
				}

				await projectsTaskCollection.insertMany(duplicateTasks)

				const projectsTasksDetailsAfterInsert = await projectsTaskCollection
					.find({
						externalId: {
							$in: duplicateTasks.map((tasks) => tasks.externalId),
						},
					})
					.toArray()

				// if certificate is there , replace the task details with object ids
				if (certificate && Object.keys(certificate).length > 0) {
					const conditionsList = Object.keys(certificate.criteria.conditions)
					conditionsList.forEach((condition) => {
						Object.keys(certificate.criteria.conditions[condition].conditions).forEach((subCondition) => {
							if (
								certificate.criteria.conditions[condition].conditions[subCondition].scope ==
									common.TASK &&
								certificate?.criteria?.conditions[condition].conditions[subCondition]?.taskDetails &&
								certificate?.criteria?.conditions[condition].conditions[subCondition]?.taskDetails
									.length > 0
							) {
								let taskDetailObjectIds = []
								certificate?.criteria?.conditions[condition].conditions[
									subCondition
								]?.taskDetails.forEach((taskDetail) => {
									const taskFound = projectsTasksDetailsAfterInsert.find(
										(task) => task.externalId == taskDetail
									)
									if (taskFound) taskDetailObjectIds.push(taskFound._id)
								})
								certificate.criteria.conditions[condition].conditions[subCondition].taskDetails =
									taskDetailObjectIds ? taskDetailObjectIds : []
							}
						})
					})
				}

				taskMap = _.mapValues(taskMap, (externalId) => {
					// Find the corresponding object from projectsTasksDetailsAfterInsert
					const task = _.find(projectsTasksDetailsAfterInsert, { externalId: externalId })

					// If found, replace externalId with _id; otherwise, keep the externalId
					return task ? ObjectId(task._id) : externalId
				})
				// update the project template after tasks created
				templateProjects.forEach((project) => {
					let projectTasks = []
					project.tasks.forEach((task) => {
						projectTasks.push(taskMap[task])
					})
					project.tasks = projectTasks
					project.taskSequence = taskSeqMap[project.externalId]
				})
				// create project templates
				await projectsCollection.insertMany(templateProjects)
			}

			let updatedProjectTemplates =
				(await projectsCollection
					.find({
						externalId: {
							$in: templateProjects.map((projects) => projects.externalId),
						},
					})
					.toArray()) || []

			// Add a new 'type', 'resource_id' , 'rolloutId' keys to each project
			updatedProjectTemplates = updatedProjectTemplates.map((project) => ({
				...project, // Spread the existing project fields
				certificate,
				type: common.PROJECT,
				resource_id: templateProjectsIdMap[project.externalId].resource_id,
				rolloutId: templateProjectsIdMap[project.externalId].rollout_id,
			}))

			return {
				success: true,
				data: [...updatedProjectTemplates],
			}
		}
	} catch (error) {
		console.error('ERROR in DUPLICATING TEMPLATE : ', error)
		return {
			success: false,
			error,
		}
	}
}

/**
 * Process targeting criteria
 * @name processTargetingCriteria
 * @param {Object} targetingData - Program template data
 * @returns {Object} - Response contains scope and metaInformation
 */
const processTargetingCriteria = async (targetingData) => {
	try {
		let scope = {
			entityType: 'state',
			entities: [],
			roles: [],
		}
		const entitiesList = ['state', 'district', 'block', 'cluster', 'school']

		targetingData = targetingData.map((criteria) => {
			for (let criteriaKey of Object.keys(criteria)) {
				if (entitiesList.includes(criteriaKey)) {
					scope.entities = criteria[criteriaKey]
						.map((entity) => entity?.id || entity?._id || null)
						.filter((id) => id !== null)
				} else if (criteriaKey === 'roles') {
					scope.roles = criteria[criteriaKey]
						.map((role) => role?.id || role?._id || null)
						.filter((id) => id !== null)
				}
			}
			return criteria
		})

		return { scope, success: true }
	} catch (error) {
		console.log('Error in creating targeting : ', error)
		return {
			success: false,
			error,
		}
	}
}

const orderSolutionsInProgram = (resourceWithInProgram) => {
	let solutionOrderList = resourceWithInProgram.map((item) => {
		let res = {
			id: item.id,
		}
		if (item?.published_id) res._id = ObjectId(item.published_id)
		if (item?.order) res.order = item.order
		return res
	})

	const usedOrders = new Set()

	// First, process items with explicit orders
	for (let i = 0; i < resourceWithInProgram.length; i++) {
		const item = resourceWithInProgram[i]
		if (item.order != null) {
			let ord = item.order
			while (usedOrders.has(ord)) {
				ord++
			}
			solutionOrderList[i].order = ord
			usedOrders.add(ord)
		}
	}

	// Then, process items without explicit orders (null or undefined)
	for (let i = 0; i < resourceWithInProgram.length; i++) {
		const item = resourceWithInProgram[i]
		if (item.order == null) {
			let ord = i + 1
			while (usedOrders.has(ord)) {
				ord++
			}
			solutionOrderList[i].order = ord
			usedOrders.add(ord)
		}
	}

	return solutionOrderList.reduce((acc, item) => {
		acc[item.id] = { order: item.order }
		if (item._id) acc[item.id]._id = item._id
		return acc
	}, {})
}

/**
 * Format Program Template
 * @name formatProgramTemplate
 * @param {Object} programData - Program template data
 * @returns {Object} - Response contains formatted template
 */
const formatProgramTemplate = async (programData) => {
	try {
		let programDocument = {}
		if (programData?.targeting_criteria) {
			const targeting = await processTargetingCriteria(programData?.targeting_criteria)
			if (!targeting?.success) {
				return {
					success: false,
					error: targeting?.error,
				}
			}
			programDocument.scope = targeting?.scope ? targeting?.scope : {}
		}
		programDocument.updatedAt = new Date()
		programDocument.endDate = new Date(programData?.end_date)
		programDocument.startDate = new Date(programData?.start_date)
		// if the program is already published , update _id from the published_id
		if (programData?.published_id) {
			programDocument._id = ObjectId(programData.published_id)
		} else {
			let language = programData?.language
				? programData?.resource.flatMap((resource) => {
						return resource.languages.map((language) => {
							return language.label
						})
				  })
				: []

			language = [...new Set(language)]
			let keywords = programData?.keywords
				? programData?.keywords
				: programData?.resource
				? utils.formatKeywords(programData?.resource?.keywords)
				: []
			keywords = [...new Set(keywords)]

			programDocument = {
				...programDocument,
				...{
					resourceType: [common.ROLLOUT_TYPE_PROGRAM],
					language,
					keywords,
					concepts: programData?.concepts ? programData?.concepts : [],
					components: [],
					isAPrivateProgram: false,
					isDeleted: false,
					requestForPIIConsent: programData?.requestForPIIConsent ? true : false,
					rootOrganisations: [
						programData?.rootOrganisations ? programData?.rootOrganisations : programData?.organization?.id,
					],
					createdFor: [programData?.createdFor ? programData?.createdFor : programData?.organization?.id],
					deleted: false,
					status: common.STATUS_ACTIVE.toLowerCase(),
					owner: programData?.created_by,
					createdBy: programData?.created_by,
					updatedBy: programData?.created_by,
					externalId: utils.generateExternalId(programData?.title),
					name: programData?.title.trim(),
					description: programData?.resource?.objective || '',
					createdAt: new Date(),
					scp_reference_id: programData.resource_id,
				},
			}
		}
		return { success: true, programDocument }
	} catch (error) {
		console.error('Error in formatTemplate:', error.message)
		return { success: false, error: error.message }
	}
}

/**
 * create svg template by editing base template.
 * @method
 * @name createSvg
 * @param {Object} certificateData - Certificate data for upload
 */

async function createSvg(certificateData, loggedInUserId, userToken) {
	return new Promise(async (resolve, reject) => {
		try {
			// fetch base template from cloud
			let baseTemplate = await getBaseTemplate(certificateData?.base_template_url)
			if (!baseTemplate.success) {
				throw new Error('Base template download failed.')
			}

			// Load SVG template using Cheerio with XML mode
			const $ = cheerio.load(baseTemplate.result, { xmlMode: true })

			// set issuer name
			const issuerNameTag = 'stateTitle'
			const issuerNameElement = $(`#${issuerNameTag}`)
			issuerNameElement.text(utils.escapeXml(certificateData.issuer))

			// update signature
			for (let index = 1; index <= certificateData.signature.no_of_signature; index++) {
				const signatureNameTag = `signatureTitle${index}a`
				const signatureDesignationTag = `signatureTitleDesignation${index}`
				const signatureImgTag = `signatureImg${index}`
				await waitForSocketAvailability() // check and wait for axios socket availability
				const imageData = await downloadAndConvertToBase64(certificateData.signature[signatureImgTag])
				const signatureNameElement = $(`#${signatureNameTag}`)
				const signatureImgElement = $(`#${signatureImgTag}`)
				signatureImgElement.attr('xlink:href', utils.escapeXml(imageData))
				signatureNameElement.text(
					`${utils.escapeXml(certificateData.signature[`signatureTitleName${index}`])} , ${utils.escapeXml(
						certificateData.signature[signatureDesignationTag]
					)}`
				)
			}

			// update logos
			for (let index = 1; index <= certificateData.logos.no_of_logos; index++) {
				const logoTag = `stateLogo${index}`
				await waitForSocketAvailability() // check and wait for axios socket availability
				const imageData = await downloadAndConvertToBase64(certificateData.logos[logoTag])
				const logoElement = $(`#${logoTag}`)
				logoElement.attr('xlink:href', utils.escapeXml(imageData))
			}

			// updated svg
			let updatedSvg = $.xml()

			// replace quote escape charecters with "
			updatedSvg = updatedSvg.replace(/&quot;/g, '"')

			const uniqueId = utils.generateUniqueId() //generate a unique id for folder
			let fileName = `${uniqueId}.svg` //create a unique file name
			const mainPath = path.join(__dirname, `../temp/certificate/`) //temporary folder path for certificate template
			let dirPath = path.join(mainPath, `${uniqueId}/`) //create a directory path
			fs.mkdirSync(dirPath, { recursive: true }) //create directory
			fs.writeFileSync(path.join(dirPath, fileName), updatedSvg, { encoding: 'utf8' }) //create file

			// create a file upload payload
			let payloadData = {
				request: {
					[common.CERTIFICATE]: {
						files: [fileName],
					},
				},
			}
			// generate signed url
			const headers = {
				'X-auth-token': userToken.replace(/^bearer\s+/i, ''),
			}
			const getSignedUrl = await generatePresignedUrlInConsumption(
				process.env.INTERFACE_SERVICE_HOST +
					process.env.CONSUMPTION_SERVICE_BASE_URL +
					process.env.CONSUMPTION_SERVICE_PRESIGNED_URL,
				payloadData,
				headers
			)
			if (!getSignedUrl.success) {
				throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
			}

			const fileUploadUrl = getSignedUrl.url
			let uploadedFilePath = getSignedUrl.file
			await uploadFile(dirPath, fileName, fileUploadUrl)
			// delete folder after upload
			await deleteFolderRecursive(path.join(mainPath, uniqueId))

			resolve({
				message: 'Template edited successfully',
				filePath: uploadedFilePath,
			})
		} catch (error) {
			reject(error)
		}
	})
}

async function generatePresignedUrlInConsumption(url, body, headers) {
	try {
		const response = await axios.post(url, body, { headers, timeout: 6000 })
		let result = { success: false }
		if (response.status === 200) {
			const files = response?.data?.result?.[common.CERTIFICATE]?.files

			if (Array.isArray(files) && files.length > 0) {
				result.file = files[0]?.payload?.sourcePath || null
				result.url = files[0]?.url || null
				result.success = true
			} else {
				console.error('Files array is missing or empty:', files)
			}
		} else {
			console.error('Unexpected response status:', response.status)
		}

		return result
	} catch (error) {
		console.error('Error generating consumption presigned URL:', error.message)
		throw error // Rethrow the error to be handled by the caller
	}
}

async function uploadFile(dirPath, fileName, fileUploadUrl) {
	try {
		// Read the file data
		const fileData = fs.readFileSync(path.join(dirPath, fileName))

		const headers = {
			'Content-Type': 'multipart/form-data',
		}

		// Perform the PUT request
		const fileUploadToSignedUrl = await axios.put(fileUploadUrl, fileData, { headers })

		// Check the response status
		if (fileUploadToSignedUrl.status === 200) {
			console.log('File uploaded successfully!')
			console.log('Response status:', fileUploadToSignedUrl.status)
		} else {
			console.error('Unexpected response:', fileUploadToSignedUrl.status)
		}
	} catch (error) {
		console.error('Error uploading file:', error.message)
		if (error.response) {
			console.error('Response status:', error.response.status)
			console.error('Response data:', error.response.data)
		}
	}
}

/**
 * Check and Insert certificate base template
 * @method
 * @name checkCertificateBaseTemplate
 * @param {Object} baseTemplateDetails - Certificate data for base template creation
 * @returns {Object} result - baseTemplateId
 */
async function checkCertificateBaseTemplate(baseTemplateDetails) {
	// ensure mongo connection (lazy init similar to elevate.js)
	projectsMongoConnection = projectsMongoConnection ? projectsMongoConnection : await connectMongo(projectsMongoDBUrl)
	const certificateBaseTemplateCollection = projectsMongoConnection.collection(COLLECTIONS.CERTIFICATE_BASE_TEMPLATE)
	const certificateBaseTemplate = await certificateBaseTemplateCollection.findOne({
		code: baseTemplateDetails.code,
	})
	let result = {}
	if (certificateBaseTemplate?._id) {
		result._id = ObjectId(certificateBaseTemplate?._id)
	} else {
		const certificateFetched = await certificateBaseTemplateQueries.findOne({
			code: baseTemplateDetails.code,
		})
		const certificateBaseTemplateDocument = {
			code: certificateFetched.code,
			name: certificateFetched.name,
			url: certificateFetched.url,
			createdAt: new Date(),
			updatedAt: new Date(),
			deleted: false,
		}

		const insertResult = await certificateBaseTemplateCollection.insertOne(certificateBaseTemplateDocument)
		result._id = insertResult.insertedId
	}

	return result
}

/**
 * Insert certificate templates
 * @method
 * @name insertCertificateTemplate
 * @param {Object} certificateData - Certificate data for upload
 * @param {String} solutionId - solutionId of the created solution
 * @param {String} programId - programId of the created program
 */
async function insertCertificateTemplate(certificateData, solutionId, programId, loggedInUserId, userToken) {
	const svgTemplateCreation = await createSvg(certificateData, loggedInUserId, userToken)
	const baseTemplate = await checkCertificateBaseTemplate(certificateData)
	const certificateDocument = {
		status: common.STATUS_ACTIVE.toLowerCase(),
		deleted: false,
		solutionId,
		programId,
		baseTemplateId: baseTemplate._id,
		createdAt: new Date(),
		updatedAt: new Date(),
		templateUrl: svgTemplateCreation.filePath,
		issuer: { name: certificateData.issuer },
		criteria: certificateData.criteria,
	}

	// Insert the template into the database
	// ensure mongo connection (lazy init similar to elevate.js)
	projectsMongoConnection = projectsMongoConnection ? projectsMongoConnection : await connectMongo(projectsMongoDBUrl)
	const certificateTemplateCollection = projectsMongoConnection.collection(COLLECTIONS.CERTIFICATE_TEMPLATE)
	const result = await certificateTemplateCollection.insertOne(certificateDocument)

	// Validate the result of the template creation
	if (!result || !result.insertedId) {
		throw new Error(`Failed to insert the template into the ${COLLECTIONS.CERTIFICATE_TEMPLATE} collection.`)
	}
	// update the solution with the certificate template id
	// ensure mongo connection (lazy init similar to elevate.js)
	projectsMongoConnection = projectsMongoConnection ? projectsMongoConnection : await connectMongo(projectsMongoDBUrl)
	const solutionTemplateCollection = projectsMongoConnection.collection(COLLECTIONS.SOLUTIONS)
	const resultUpdateSolution = await solutionTemplateCollection.updateOne(
		{ _id: solutionId },
		{
			$set: {
				certificateTemplateId: result.insertedId,
			},
		}
	)

	// Validate the result of the template creation
	if (!resultUpdateSolution) {
		throw new Error(`Failed to update the template into the ${COLLECTIONS.SOLUTIONS} collection.`)
	}
	// update the template into projectTemplate collection
	// ensure mongo connection (lazy init similar to elevate.js)
	projectsMongoConnection = projectsMongoConnection ? projectsMongoConnection : await connectMongo(projectsMongoDBUrl)
	const projectTemplateCollection = projectsMongoConnection.collection(COLLECTIONS.TEMPLATES)
	const resultUpdateProjecTemplate = await projectTemplateCollection.updateOne(
		{ solutionId },
		{
			$set: {
				certificateTemplateId: result.insertedId,
			},
		}
	)

	// Validate the result of the template creation
	if (!resultUpdateProjecTemplate.matchedCount) {
		throw new Error(`No document found with solutionId: ${solutionId} in the ${COLLECTIONS.TEMPLATES} collection.`)
	}

	if (resultUpdateProjecTemplate.modifiedCount === 0) {
		throw new Error(
			`Document with solutionId: ${solutionId} was found but not updated in the ${COLLECTIONS.TEMPLATES} collection.`
		)
	}

	return true
}

/**
 * function to recursively delete folder after upload
 * @method
 * @name deleteFolderRecursive
 * @param {String} folderPath - folder path to delete
 */
async function deleteFolderRecursive(folderPath) {
	// Check if the folder exists
	if (fs.existsSync(folderPath)) {
		// Get all files and subdirectories in the folder
		fs.readdirSync(folderPath).forEach((file) => {
			const currentPath = path.join(folderPath, file)

			// If the item is a directory, recursively delete its contents
			if (fs.lstatSync(currentPath).isDirectory()) {
				deleteFolderRecursive(currentPath)
			} else {
				// Otherwise, delete the file
				fs.unlinkSync(currentPath)
			}
		})
		// Delete the empty folder
		fs.rmdirSync(folderPath)
		console.log(`Folder and its contents deleted: ${folderPath}`)
	} else {
		console.log('Folder does not exist:', folderPath)
	}
}

/**
 *  Function to fetch data information from cloud using downloadable Url
 * @method
 * @name getBaseTemplate
 * @param {String} templateUrl - cloud path to download
 */
async function getBaseTemplate(templateUrl) {
	try {
		// Mark socket as engaged
		socketInUse = true
		const response = await axios.get(templateUrl)
		// Mark socket as free
		socketInUse = false
		if (response.status === 200) {
			return {
				success: true,
				result: response.data,
			}
		} else {
			throw new Error(`Unexpected response status: ${response.status}`)
		}
	} catch (error) {
		// Mark socket as free
		socketInUse = false
		return Promise.reject(new Error(`Failed to fetch base template: ${error.message}`))
	}
}

async function waitForSocketAvailability() {
	return new Promise((resolve) => {
		const checkInterval = setInterval(() => {
			if (!socketInUse) {
				clearInterval(checkInterval)
				resolve()
			}
		}, 1000) // Check every second
	})
}
/**
 *  download file from cloud and convert it into base64
 * @method
 * @name downloadAndConvertToBase64
 * @param {String} templateUrl - cloud path to download
 */
async function downloadAndConvertToBase64(url) {
	try {
		// Wait if the socket is in use
		if (socketInUse) {
			console.log('Socket is in use. Waiting for 1 minute...')
			await new Promise((resolve) => setTimeout(resolve, 60000)) // Wait for 1 minute
		}

		// Mark socket as in use
		socketInUse = true

		// Download the image file as a binary buffer
		const response = await axios({
			url,
			method: 'GET',
			responseType: 'arraybuffer', // Ensures we receive raw binary data
			timeout: 120000,
			headers: {
				Connection: 'close', // Ensures the socket is closed after the request
			},
		})

		// Convert the binary data to a Base64 string
		const base64 = Buffer.from(response.data, 'binary').toString('base64')

		// Create the Base64 Data URL
		const base64DataUrl = `data:image/png;base64,${base64}`

		// Mark socket as free
		socketInUse = false

		return base64DataUrl
	} catch (error) {
		console.error('Error downloading or converting file:', error.message)
		// Mark socket as free
		socketInUse = false
		throw error
	}
}

/**
 *  Create program template and insert it into mongo
 * @method
 * @name createProgram
 * @param {Object} programTemplate - Program data
 * @return {String} programId - Program _id
 */
async function createProgram(programTemplate) {
	try {
		// Insert the template into the database
		// ensure mongo connection (lazy init similar to elevate.js)
		projectsMongoConnection = projectsMongoConnection
			? projectsMongoConnection
			: await connectMongo(projectsMongoDBUrl)
		const programsCollection = projectsMongoConnection.collection(COLLECTIONS.PROGRAMS)
		const result = await programsCollection.insertOne(programTemplate)
		// Validate the result of the template creation
		if (!result || !result.insertedId) {
			throw new Error('Failed to insert the template into the database.')
		}
		return {
			success: true,
			_id: result.insertedId,
		}
	} catch (error) {
		console.log('Create Program Error : ', error)
		return {
			success: false,
			error,
		}
	}
}

/**
 *  Update program template in mongo
 * @method
 * @name updateProgram
 * @param {String} programId - Program _id
 * @param {Object} programTemplate - Program data
 * @return {String} programId - Program _id
 */
async function updateProgram(programId, updateTemplate) {
	try {
		// Update the template in the database
		// ensure mongo connection (lazy init similar to elevate.js)
		projectsMongoConnection = projectsMongoConnection
			? projectsMongoConnection
			: await connectMongo(projectsMongoDBUrl)
		const programsCollection = projectsMongoConnection.collection(COLLECTIONS.PROGRAMS)
		await programsCollection.updateOne(
			{ _id: programId },
			{
				$set: _.omit(updateTemplate, '_id', 'published_id'),
			}
		)
		return {
			success: true,
			_id: programId,
		}
	} catch (error) {
		console.log('Update Program Error : ', error)
		return {
			success: false,
			error,
		}
	}
}

/**
 *  updateSolution template
 * @method
 * @name updateSolutionTemplate
 * @param {Object} resource - resource data
 * @return {Object} updateBody - resource update body
 */
async function updateSolutionTemplate(resource) {
	const targeting = await processTargetingCriteria(resource?.targeting_criteria)
	if (!targeting?.success) {
		return {
			success: false,
			error: targeting.error,
		}
	}
	return {
		success: true,
		data: {
			language: resource?.languages ? resource?.languages.map((language) => language.label) : [],
			keywords: resource?.keywords ? utils.formatKeywords(resource?.keywords) : [],
			name: resource?.title,
			updatedAt: new Date(),
			scope: targeting?.scope ? targeting?.scope : {},
			endDate: resource.end_date,
			startDate: resource.start_date,
		},
	}
}
/**
 * Publish the Program
 * @name publishProgram
 * @param {Object} programData - Program template data
 * @returns {Object} - Response of Program creation
 */
const publishProgram = function async(programData) {
	return new Promise(async (resolve, reject) => {
		const result = { success: false, templateId: null, error: null }
		try {
			console.log(' ======= START Publish Program =======')
			const userToken = programData.userToken
			const loggedInUserId = programData.userId
			scopeKeys = await targetingHelpers.scopeKeys(programData.organization_code, programData.tenant_code)
			let rolloutDetails = await rolloutService.details(
				programData.id,
				loggedInUserId,
				programData.organization_code,
				programData.tenant_code,
				false, //return blob path
				true // return resource details
			)
			rolloutDetails = rolloutDetails?.result || {}
			const isProgramResource = rolloutDetails.resource_type === common.RESOURCE_TYPE_PROGRAM
			const programResourceTableId = isProgramResource ? rolloutDetails.resource_id : null

			// Format the program template
			let formattedTemplate = await formatProgramTemplate(rolloutDetails)

			if (!formattedTemplate.success) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.programDocument

			let programResourceRolloutMap = {}
			let programResourceIds = []
			if (isProgramResource) {
				// get the resource ids in a program
				programResourceIds = Array.isArray(rolloutDetails?.resources)
					? rolloutDetails.resources.map((resource) => resource.id)
					: []
			} else {
				if (rolloutDetails?.resource_details?.id) programResourceIds.push(rolloutDetails?.resource_details?.id)
			}

			if (programResourceIds.length > 0) {
				// find all the resource rollout data
				const rolloutData = await rolloutQueries.findAll(
					{
						resource_id: {
							[Op.in]: programResourceIds,
						},
						type: common.ROLLOUT_TYPE_SOLUTION,
					},
					['id', 'resource_id']
				)

				if (rolloutData?.length > 0) {
					// create a map of resource id and rollout id
					rolloutData.forEach((rollout) => {
						programResourceRolloutMap[rollout.resource_id] = rollout.id
					})
				}
			} else {
				throw new Error('Add atleast one resource to the Program.')
			}

			let result = {}
			let solutions = []
			let programId = template?._id ? ObjectId(template?._id) : null
			projectsMongoConnection = projectsMongoConnection
				? projectsMongoConnection
				: await connectMongo(projectsMongoDBUrl)

			// if program is already created , update scope , start and end dates  else create a new program
			if (programId) {
				const updateProgramResponse = await updateProgram(programId, template)
				if (!updateProgramResponse?.success) {
					throw new Error(updateProgramResponse?.error)
				}
				programId = updateProgramResponse._id
			} else {
				const createProgramResponse = await createProgram(template)
				if (!createProgramResponse?.success) {
					throw new Error(createProgramResponse?.error)
				}
				programId = createProgramResponse._id
			}

			const resourceWithInProgram = isProgramResource
				? rolloutDetails?.resources
				: [rolloutDetails?.resource_details]
			if (resourceWithInProgram.length === 0) {
				console.error('Consumption Error : Program Resources Empty.')
				throw new Error('NO_RESOURCE_ADDED')
			}
			let solutionIds = []
			let solutionOrderMap = programDTO.orderSolutionsInProgram(resourceWithInProgram)
			let resourceToUpdate = []

			for (const resource of resourceWithInProgram) {
				// for programs check the map and get the rollout id from resource id
				// for single rollout use the rollout id directly
				const rolloutId = programResourceRolloutMap[resource.id]
				if (!rolloutId)
					throw new Error(
						`Rollout For Resource ( ${resource?.id} ) ${
							isProgramResource ? 'within Program ' : 'within Single rollout '
						} is not created`
					)
				let fetchDetails = await rolloutService.details(
					rolloutId,
					programData.userId,
					programData.organization_code,
					programData.tenant_code,
					false,
					true
				)

				if (!fetchDetails?.result?.published_id) {
					// publish a new template based on the type of the resource
					if (
						fetchDetails?.result?.type == common.PROJECT ||
						fetchDetails?.result?.resource_type == common.PROJECT
					) {
						let publishedProject
						let projectCertificate = {}

						// create a new project template
						if (isProgramResource) {
							publishedProject = await publishProjectTemplates({
								id: fetchDetails?.result?.resource_id,
								..._.omit(fetchDetails?.result, ['id']),
								tenant_code: programData?.tenant_code,
							})
							projectCertificate =
								fetchDetails?.result?.certificate &&
								Object.keys(fetchDetails?.result?.certificate).length > 0
									? fetchDetails?.result?.certificate
									: fetchDetails?.result.resource_details?.certificate &&
									  Object.keys(fetchDetails?.result.resource_details?.certificate).length > 0
									? fetchDetails?.result.resource_details?.certificate
									: {}
							fetchDetails.result = { ...fetchDetails.result, ...fetchDetails?.result.resource_details }
						} else {
							const fetchProjectDetails = await projectService.details(
								resource.id,
								resource?.organization_code,
								resource?.tenant_code
							)
							publishedProject = { templateId: fetchProjectDetails?.result?.published_id }
							fetchDetails.result = {
								...fetchDetails.result,
								..._.omit(fetchProjectDetails?.result, Object.keys(fetchDetails.result)),
							}
							projectCertificate = fetchProjectDetails?.result?.certificate || {}
						}

						let duplicateResource = await duplicateResources(
							{
								...fetchDetails?.result,
								published_id: publishedProject?.templateId,
							},
							projectCertificate,
							programData,
							template
						)
						if (!duplicateResource.success) {
							console.log('Error in creating duplicate Resource')
							throw new Error(
								`Error in creating duplicate Resource ${duplicateResource?.error || 'Unknown Error'}`
							)
						}

						const targeting = await processTargetingCriteria(fetchDetails?.result?.targeting_criteria)
						if (!targeting?.success) {
							throw new Error(
								`Error in processing targetting criteria : ${targeting?.error || 'Unknown Error'}`
							)
						}

						let programDetails = {
							_id: programId,
							scope: template.scope,
							externalId: template.externalId,
							name: template?.name,
							description: template?.description ? template?.description : '',
							end_date: template?.endDate,
							start_date: template?.startDate,
							created_by: programData.userId,
							orgId: programData.organization_code,
							tenantId: programData.tenant_code,
						}
						if (isProgramResource) {
							programDetails.start_date = fetchDetails?.result?.start_date
							programDetails.end_date = fetchDetails?.result?.end_date
							programDetails.scope = targeting.scope
						}
						const createSolutionsData = await createSolutions(
							duplicateResource.data,
							programDetails,
							userToken
						)
						solutionOrderMap[resource.id]._id = createSolutionsData.data[0]._id
						if (!createSolutionsData.success)
							throw new Error(`Error : ${createSolutionsData?.error || 'Unknown Error'}`)
						solutions = [...solutions, ...createSolutionsData.data]
					}
				} else {
					solutionIds.push(fetchDetails?.result?.published_id)
					const updatePayload = await updateSolutionTemplate(fetchDetails?.result)
					if (!updatePayload?.success) {
						throw new Error(`Error in creating update body : ${updatePayload?.error || 'Unknown Error'}`)
					}
					resourceToUpdate.push({
						_id: fetchDetails?.result?.published_id,
						updatePayload: updatePayload.data,
					})
				}
			}
			if (resourceToUpdate.length > 0) {
				// ensure mongo connection (lazy init similar to elevate.js)
				projectsMongoConnection = projectsMongoConnection
					? projectsMongoConnection
					: await connectMongo(projectsMongoDBUrl)
				const solutionCollection = projectsMongoConnection.collection(COLLECTIONS.SOLUTIONS)

				const resourceToUpdatePromise = resourceToUpdate.map((resourceData) => {
					return solutionCollection.updateOne(
						{ _id: ObjectId(resourceData._id) },
						{
							$set: resourceData.updatePayload,
						}
					)
				})

				if (resourceToUpdatePromise.length > 0) {
					await Promise.all(resourceToUpdatePromise)
				}
			}

			if (Object.keys(solutionOrderMap).length > 0) {
				const components = Object.values(solutionOrderMap)
					.map(({ _id, order }) => ({ _id, order }))
					.sort((a, b) => a.order - b.order)

				await updateProgram(programId, {
					components,
				})
			}
			if (isProgramResource && programResourceTableId) {
				// update resource table with published Id
				await resourceService.publishCallback(
					programData.resource_id,
					programId ? programId.toString() : null,
					programData?.tenant_code
				)
			}
			// update rollout table with published Id
			await rolloutService.publishCallback(
				programData.id,
				programId ? programId.toString() : null,
				null,
				programData?.tenant_code,
				isProgramResource
			)
			solutions.forEach(async (solution) => {
				if (isProgramResource) {
					// update resource table with published Id
					await resourceService.publishCallback(
						solution.scp_reference_id,
						solution?._id ? solution?._id.toString() : null,
						programData?.tenant_code,
						solution?.link ? solution?.link : false
					)
				}
				// update rollout table with published Id
				if (solution.rolloutId) {
					await rolloutService.publishCallback(
						solution.rolloutId,
						solution?._id ? solution?._id.toString() : null,
						solution?.projectTemplateId ? solution?.projectTemplateId.toString() : null,
						programData?.tenant_code,
						isProgramResource
					)
				}
			})

			// create user and program mapping
			// guard rolloutDetails.viewers in case it's missing or not an array
			const viewersArray = Array.isArray(rolloutDetails?.viewers) ? rolloutDetails.viewers : []
			const viewerIds = viewersArray.map((viewer) => viewer?.id || viewer)
			if (programId && Array.isArray(viewerIds) && viewerIds.length > 0) {
				let createMappingResponse = await createOrUpdateUserProgramMapping(
					viewerIds,
					programId,
					programData.organization_code,
					programData.tenant_code,
					loggedInUserId
				)
				console.log('User Program Mapping Response : ', createMappingResponse)
			}

			//return result
			result.success = true
			result.programId = programId
			console.log(' ======= END Publish Program =======')
			return resolve(result)
		} catch (error) {
			console.error('-----------> Consumption ERROR : ', error)
			console.log(' ======= END Publish Program =======')
			result.error = `Error: ${error.message}`
			result.success = false

			// update rollout status failed in case of error
			await rolloutQueries.updateOne(
				{
					id: programData.id,
					tenant_code: programData.tenant_code,
				},
				{
					status: common.ROLLOUT_STATUS_FAILED,
				}
			)

			return resolve(result)
		}
	})
}
module.exports = {
	publishProjectTemplates,
	publishProject,
	publishProgram,
}

/**
 * Direct DB insert/update: add or remove user->program mappings inside user_extensions collection.
 *
 * viewers: array of userIds (strings)
 * programId: string or ObjectId-like
 * orgCode, tenantCode: not used in direct DB ops but kept for signature compatibility
 * userId: actor performing this operation (used for createdBy/updatedBy)
 */
async function createOrUpdateUserProgramMapping(viewers = [], programId, orgCode, tenantCode, userId = null) {
	try {
		if (!Array.isArray(viewers)) throw new Error('viewers must be an array')
		if (!programId) throw new Error('programId is required')

		// Normalize programId: convert to ObjectId if looks like one
		let normalizedProgramId = programId
		try {
			if (typeof programId === 'string' && /^[0-9a-fA-F]{24}$/.test(programId)) {
				normalizedProgramId = new ObjectId(programId)
			}
		} catch (e) {
			// leave as-is if conversion fails
			normalizedProgramId = programId
		}

		// Roles from env (role codes)
		const roleCodes = (process.env.DEFAULT_PROGRAM_MANAGERS || '')
			.split(',')
			.map((r) => r.trim())
			.filter(Boolean)

		// If no program manager roles are configured, treat this as a no-op.
		// Log a warning with contextual info and return a successful no-op result
		// instead of throwing, to match the optional nature of this feature.
		if (roleCodes.length === 0) {
			console.warn(
				`DEFAULT_PROGRAM_MANAGERS is empty; skipping user->program mapping for program=${String(
					programId
				)}, org=${orgCode}, tenant=${tenantCode}`
			)
			return { success: true, message: 'No program manager roles configured, skipping mapping' }
		}

		// ensure mongo connection (lazy init similar to elevate.js)
		projectsMongoConnection = projectsMongoConnection
			? projectsMongoConnection
			: await connectMongo(projectsMongoDBUrl)
		const userExtColl = projectsMongoConnection.collection(COLLECTIONS.USER_EXTENSIONS)

		// Deduplicate viewers
		const viewersUnique = Array.from(new Set(viewers))

		// Fetch existing user extensions for viewers (so we know which to insert vs update)
		const existingDocs = await userExtColl
			.find({ userId: { $in: viewersUnique } }, { projection: { userId: 1, programRoles: 1 } })
			.toArray()
		const existingUserIdsSet = new Set(existingDocs.map((d) => d.userId))

		// Fetch users currently mapped to this program (regardless of role code)
		// We need them to determine removals (users mapped but not present in viewers)
		const mappedDocs = await userExtColl
			.find({ 'programRoles.programs': normalizedProgramId }, { projection: { userId: 1, programRoles: 1 } })
			.toArray()
		const currentlyMappedUserIds = mappedDocs.map((d) => d.userId)

		const viewersSet = new Set(viewersUnique)

		// Compute toAppend and toRemove
		// toAppend: viewersUnique where programId not present for any of the configured role codes
		const toAppend = []
		for (const uid of viewersUnique) {
			const doc = existingDocs.find((d) => d.userId === uid)
			if (!doc) {
				// no doc -> needs full insert
				toAppend.push(uid)
				continue
			}
			// check for each roleCode that there exists a programRoles entry with code == roleCode and programs contains programId
			const hasProgramInSomeRole =
				Array.isArray(doc.programRoles) &&
				doc.programRoles.some(
					(pr) =>
						roleCodes.includes(String(pr.code)) &&
						Array.isArray(pr.programs) &&
						pr.programs.some((p) => String(p) === String(normalizedProgramId))
				)
			if (!hasProgramInSomeRole) toAppend.push(uid)
		}

		// toRemove: users currently mapped to this program but not in viewers
		const toRemove = currentlyMappedUserIds.filter((uid) => !viewersSet.has(uid))

		// Prepare bulk operations
		const bulkOps = []

		const now = new Date()
		const actor = userId || 'SYSTEM'

		// For users that don't exist: insert initial doc with programRoles entries
		for (const uid of toAppend) {
			if (!existingUserIdsSet.has(uid)) {
				// Build programRoles array for each roleCode
				const programRoles = roleCodes.map((rc) => ({
					programs: [normalizedProgramId],
					roleId: null, // unknown; keep null so system can populate later if needed
					code: rc,
				}))
				const newDoc = {
					userId: uid,
					programRoles,
					status: 'active',
					isDeleted: false,
					deleted: false,
					createdBy: actor,
					updatedBy: actor,
					createdAt: now,
					updatedAt: now,
				}
				bulkOps.push({
					insertOne: {
						document: newDoc,
					},
				})
			} else {
				// existing doc: for each roleCode, either push programId into matching programRoles.programs or push a new programRoles entry
				for (const rc of roleCodes) {
					// try to add to existing programRoles with matching code
					// We use an update with positional filter via arrayFilters to push into the matching role entry.
					bulkOps.push({
						updateOne: {
							filter: {
								userId: uid,
								'programRoles.code': rc,
								'programRoles.programs': { $ne: normalizedProgramId },
							},
							update: {
								$addToSet: { 'programRoles.$.programs': normalizedProgramId },
								$set: { updatedAt: now, updatedBy: actor },
							},
						},
					})

					// If there is no programRoles with this code, create one (ensure no duplicate by using upsert-like push)
					bulkOps.push({
						updateOne: {
							filter: { userId: uid, 'programRoles.code': { $ne: rc } },
							update: {
								$setOnInsert: {
									userId: uid,
									createdAt: now,
									createdBy: actor,
									status: 'active',
									isDeleted: false,
									deleted: false,
								},
								$set: { updatedAt: now, updatedBy: actor },
								$push: { programRoles: { programs: [normalizedProgramId], roleId: null, code: rc } },
							},
						},
					})
				}
			}
		}

		// For removals: remove programId from programRoles.programs arrays for each role code.
		for (const uid of toRemove) {
			for (const rc of roleCodes) {
				bulkOps.push({
					updateOne: {
						filter: { userId: uid },
						update: {
							$pull: { 'programRoles.$[pr].programs': normalizedProgramId },
							$set: { updatedAt: now, updatedBy: actor },
						},
						arrayFilters: [{ 'pr.code': rc }],
					},
				})
			}
			// After pulling programId out, remove any programRoles entries where programs becomes empty
			bulkOps.push({
				updateOne: {
					filter: { userId: uid },
					update: {
						$pull: { programRoles: { programs: { $size: 0 } } },
						$set: { updatedAt: now, updatedBy: actor },
					},
				},
			})
		}

		if (bulkOps.length === 0) {
			console.log('No DB changes required for program:', programId)
			return { success: true, message: 'No changes' }
		}

		// Execute bulk
		// Use ordered: false so independent ops continue on error for others
		const bulkResult = await userExtColl.bulkWrite(bulkOps, { ordered: false })

		console.log('DB update result for program', programId, {
			appended: toAppend.length,
			removed: toRemove.length,
			bulkResult,
		})

		return {
			success: true,
			programId: String(programId),
			appended: toAppend,
			removed: toRemove,
			bulkResult,
		}
	} catch (err) {
		console.error('Error in createOrUpdateUserProgramMapping (direct DB):', err)
		throw err
	}
}

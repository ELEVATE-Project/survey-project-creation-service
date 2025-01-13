/**
 * name : consumption.js
 * author : Priyanka Pradeep
 * Date : 13-Dec-2024
 * Description : Create data in elevate-project service.
 */
const common = require('@constants/common')
const resourceService = require('@services/resource')
const rolloutService = require('@services/rollouts')
const rolloutQueries = require('@database/queries/rollouts')
const certificateBaseTemplateQueries = require('@database/queries/certificateBaseTemplate')
const utils = require('@generics/utils')
const interfaceBaseUrl = process.env.INTERFACE_SERVICE_HOST
const requests = require('@generics/requests')
const endpoints = require('@constants/endpoints')
const { ObjectId } = require('mongodb')
const MongoClient = require('mongodb').MongoClient
const axios = require('axios')
const cheerio = require('cheerio')
const path = require('path')
const fs = require('fs')
const filesService = require('@services/files')
const request = require('request')
const _ = require('lodash')
let mongoDb

if (process.env.CONSUMPTION_SERVICE != common.CONSUMPTION_SERVICE_SELF) {
	const mongoUrl = process.env.MONGODB_URL

	if (!mongoUrl) {
		throw new Error('MONGODB_URL is not set in the environment variables.')
	}

	;(async () => {
		try {
			const connection = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
			await connection.connect()

			mongoDb = connection.db()
			console.log('Connected to MongoDB')
		} catch (error) {
			console.error('Failed to connect to MongoDB:', error.message)
			process.exit(1) // Exit the process if connection fails
		}
	})()
}

// Define the mongoDb collection names used
const COLLECTIONS = {
	CATEGORIES: 'projectCategories',
	TEMPLATES: 'projectTemplates',
	TASKS: 'projectTemplateTasks',
	USER_ROLES: 'userRoles',
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
			// Format the template
			let formattedTemplate = formatTemplate(templateData)
			if (!formattedTemplate.success) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.template

			//add duration key if consumption service is diksha
			if (process.env.CONSUMPTION_SERVICE == common.DIKSHA && templateData.recommended_duration) {
				template.duration = utils.convertDuration(templateData.recommended_duration)
			}

			// Process Categories
			if (templateData.categories?.length > 0) {
				let categoriesResponse = await processCategories(templateData.categories)
				if (!categoriesResponse.success) {
					throw new Error('FAILED_TO_FETCH_OR_CREATE_CATEGORIES')
				}
				template.categories = categoriesResponse.categories
			}

			//process recommededFor
			if (templateData.recommended_for?.length > 0) {
				let recommededForResponse = await convertRecommendedRolesForProjects(templateData.recommended_for)
				if (!recommededForResponse.success) {
					throw new Error('FAILED_TO_FETCH_RECOMMENDED_FOR')
				}
				template.recommendedFor = recommededForResponse?.recommendedRoles
			}

			// Insert the template into the database
			const templateCollection = mongoDb.collection(COLLECTIONS.TEMPLATES)
			const result = await templateCollection.insertOne(template)

			// Validate the result of the template creation
			if (!result || !result.insertedId) {
				throw new Error('FAILED_TO_CREATE_TEMPLATE')
			}

			const templateId = result.insertedId

			// Process and Create Tasks
			const processedTasks = assignSequenceNumbers(templateData.tasks || [])
			const taskCreationResponse = await createTasks(processedTasks, templateId, template.externalId)

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
			await resourceService.publishCallback(templateData.id, templateId.toString())

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
 * Format Project Template
 * @name formatTemplate
 * @param {Object} templateData - Project template data
 * @returns {Object} - Response contains formatted template
 */
const formatTemplate = (templateData) => {
	try {
		let template = {
			title: templateData.title,
			description: templateData.objective || '',
			keywords: utils.formatKeywords(templateData.keywords),
			isDeleted: false,
			createdBy: templateData.user_id,
			updatedBy: templateData.user_id,
			learningResources: utils.convertResources(templateData.learning_resources || []),
			isReusable: true,
			deleted: false,
			status: common.PUBLISHED_STATUS,
			externalId: utils.generateExternalId(templateData.title),
			entityType: '',
			metaInformation: utils.formatProjectMetaInformation(templateData),
			recommendedFor: [], //Initially empty
			categories: [], //Initially empty
			tasks: [], // Initially empty
			taskSequence: [], // Initially empty
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		return { success: true, template }
	} catch (error) {
		console.error('Error in formatTemplate:', error.message)
		return { success: false, error: error.message }
	}
}

/**
 * Create and Find Categories
 * @name processCategories
 * @param {Object} categories - Categories Data
 * @returns {Object} - Response contains categories data
 */
async function processCategories(categories) {
	try {
		const categoriesCollection = mongoDb.collection(COLLECTIONS.CATEGORIES)

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
async function createTasks(tasks, templateId, templateExternalId, parentId = null) {
	const result = { success: false, taskIds: [], externalIds: [], error: null }
	try {
		const taskCollection = mongoDb.collection(COLLECTIONS.TASKS)
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
				const childTaskResult = await createTasks(task.children, templateId, templateExternalId, taskId)

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
 * Assign sequence number for task
 * @name assignSequenceNumbers
 * @returns {Object} - Response contains task object
 */
const assignSequenceNumbers = (tasks) => {
	/* Temporory fix start, because elevate-project doent have the observation capability in tasks now */
	// Filter out 'observation' type tasks
	const filteredTasks = tasks.filter((task) => task.type !== 'observation')
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
		if (process.env.CONSUMPTION_SERVICE == common.DIKSHA) {
			const userRoleCollection = mongoDb.collection(COLLECTIONS.USER_ROLES)
			const roles = await userRoleCollection.find({ status: 'active' }).toArray()

			// Prepare the recommended roles for the Diksha project
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
		} else {
			const recommendedRoles = recommendedFor?.length
				? recommendedFor.filter((item) => item?.label).map((item) => item.label)
				: []

			return { success: true, recommendedRoles }
		}
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
	try {
		// array to have objects of solutions to create
		let solutionsToCreate = []
		// solution to certificate mapping
		let solutionCertificateMap = []
		// solution to rollout if map
		let solutionRolloutMap = {}
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
				description: programDetails.description,
				status: common.STATUS_ACTIVE.toLowerCase(),
				updatedAt: new Date(),
				createdAt: new Date(),
				scope: programDetails.scope,
				projectTemplateId: resource._id,
				updatedBy: programDetails.created_by,
				author: programDetails.created_by,
				endDate: programDetails.end_date,
				startDate: programDetails.start_date,
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

		const solutionCollection = mongoDb.collection(COLLECTIONS.SOLUTIONS)
		await solutionCollection.insertMany(solutionsToCreate)

		const createdSolutions = await solutionCollection
			.find({
				programId: programDetails._id,
			})
			.toArray()

		if (solutionCertificateMap && solutionCertificateMap.length > 0) {
			solutionCertificateMap.forEach((solutionMap) => {
				const targetSolution = createdSolutions.find(
					(solution) => String(solution.externalId).trim() === String(solutionMap.externalId).trim()
				)
				if (targetSolution) {
					insertCertificateTemplate(
						solutionMap.certificate,
						targetSolution._id,
						programDetails._id,
						programDetails.created_by,
						userToken
					)
				}
			})
		}
		const projectTemplateCollection = mongoDb.collection(COLLECTIONS.TEMPLATES)
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

		return createdSolutionsResponse
	} catch (error) {
		console.log(error)
	}
}

/**
 * Create a duplicate solution from the given resource details
 * @name duplicateResources
 * @param {Object} resourceDetails - Object of resource details
 * @param {String} created_by - created by user id
 * @returns {Array} Array of objects of duplicate templates
 */
const duplicateResources = async (resourceDetails, created_by) => {
	// initialise list of project templates to create
	let projectTemplateIds = []
	//initialise list of solution templates to create
	let solutionTemplateIds = []
	let certificate = resourceDetails?.certificate
	const certificateCriteriaConditions = Object.keys(certificate.criteria.conditions)
	certificateCriteriaConditions.forEach((criteriaId) => {
		Object.keys(certificate.criteria.conditions[criteriaId].conditions).forEach((eachCriteria) => {
			if (certificate.criteria.conditions[criteriaId].condition[eachCriteria].scope == common.TASK) {
				const foundTask = resourceDetails.tasks.find((eachTask) => eachTask.id == eachCriteria)
				certificate.criteria.conditions[criteriaId].condition[eachCriteria].taskName = foundTask.name
				certificate.criteria.conditions[criteriaId].condition[eachCriteria].sequence_no = foundTask.sequence_no
			}
		})
	})

	// seggregate templates based on type , all projects should be created in projectTemplates and others in solutions collection
	if (resourceDetails.type == common.PROJECT) projectTemplateIds.push(ObjectId(resourceDetails.published_id))
	else solutionTemplateIds.push(ObjectId(resourceDetails.published_id))

	// handling only project creation now. Make changes here for observation , survey etc...
	if (projectTemplateIds.length > 0) {
		const projectsCollection = mongoDb.collection(COLLECTIONS.TEMPLATES)
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
				delete project._id
				project.updatedAt = new Date()
				project.createdAt = new Date()
				project.createdBy = created_by
				project.updatedBy = created_by
				project.isReusable = false
				templateProjectsTaskMap[project.externalId] = project.tasks
				templateProjectsIdMap[project.externalId] = {
					resource_id: resourceDetails.resource_id,
					rollout_id: resourceDetails.rolloutId,
				}

				templateProjects.push(project)
			})
			// array of tasks to create
			Object.keys(templateProjectsTaskMap).forEach(async (projectExtId) => {
				templateTaskIds = [...templateTaskIds, ...templateProjectsTaskMap[projectExtId]]
			})
			templateTaskIds = [...new Set(templateTaskIds)]
			const projectsTaskCollection = mongoDb.collection(COLLECTIONS.TASKS)
			const projectsTasksDetails = await projectsTaskCollection
				.find({
					_id: {
						$in: templateTaskIds,
					},
				})
				.toArray()
			// duplicate project task details to create
			projectsTasksDetails.forEach((projectTask) => {
				let oldTaskExtId = projectTask.externalId
				projectTask.externalId = utils.generateUniqueId()
				const conditionsList = Object.keys(certificate.criteria.conditions)
				conditionsList.forEach((condition) => {
					Object.keys(certificate.criteria.conditions[condition].conditions).forEach((subCondition) => {
						if (
							certificate.criteria.conditions[condition].conditions[subCondition].scope == common.TASK &&
							certificate.criteria.conditions[condition].conditions[
								subCondition
							].taskName.toLowerCase() == projectTask.name.toLowerCase()
						) {
							certificate.criteria.conditions[condition].conditions[projectTask.externalId] = _.omit(
								certificate.criteria.conditions[condition].conditions[subCondition],
								'taskName',
								'sequence_no'
							)
							delete certificate.criteria.conditions[condition].conditions[subCondition]
							certificate.criteria.conditions[condition].conditions[projectTask.externalId].taskDetails =
								[projectTask.externalId]
							certificate.criteria.conditions[condition].expression = certificate.criteria.conditions[
								condition
							].expression.replace(subCondition, externalId)
						}
					})
				})
				// replace old task id by new task id in sequence
				_.update(taskSeqMap, projectTask.projectTemplateExternalId + externalId_suffixing, (tasks) =>
					tasks.map((task) => (task === oldTaskExtId ? projectTask.externalId : task))
				)
				taskMap[projectTask._id] = projectTask.externalId
				projectTask.updatedAt = new Date()
				projectTask.createdAt = new Date()
				projectTask.createdBy = created_by
				projectTask.updatedBy = created_by
				projectTask.projectTemplateExternalId = projectTask.projectTemplateExternalId + externalId_suffixing
				delete projectTask._id
				duplicateTasks.push(projectTask)
			})

			await projectsTaskCollection.insertMany(duplicateTasks)

			const projectsTasksDetailsAfterInsert = await projectsTaskCollection
				.find({
					externalId: {
						$in: duplicateTasks.map((tasks) => tasks.externalId),
					},
				})
				.toArray()

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

		const projectTemplatesAfterInsert = await projectsCollection
			.find({
				externalId: {
					$in: templateProjects.map((projects) => projects.externalId),
				},
			})
			.toArray()

		// Add a new 'type', 'resource_id' , 'rolloutId' keys to each project
		const updatedProjectTemplates = projectTemplatesAfterInsert.map((project) => ({
			...project, // Spread the existing project fields
			certificate,
			type: common.PROJECT,
			resource_id: templateProjectsIdMap[project.externalId].resource_id,
			rolloutId: templateProjectsIdMap[project.externalId].rollout_id,
		}))

		return [...updatedProjectTemplates]
	}
}

/**
 * Process targeting criteria
 * @name processTargetingCriteria
 * @param {Object} targetingData - Program template data
 * @returns {Object} - Response contains scope and metaInformation
 */
const processTargetingCriteria = async (targetingData) => {
	let scope = {
		roles: [],
		entityType: [],
	}
	let metaInformation = {
		recommendedFor: [],
	}

	if (targetingData) {
		// Iterate through each targeting criterion
		targetingData.forEach((targeting) => {
			const targetingEntity = targeting?.entity_targeting?.value

			scope.entityType.push(targetingEntity)

			if (targeting?.roles?.length) {
				// Add unique roles to scope and metaInformation
				targeting.roles.forEach(({ code, label }) => {
					scope.roles.push(code)
					metaInformation.recommendedFor.push(label)
				})
			} else {
				// Reset roles and recommendedFor if no roles are present
				scope.roles = []
				metaInformation.recommendedFor = []
			}

			// Add entity-specific targets to scope and metaInformation
			targeting[targetingEntity]?.forEach(({ name, _id }) => {
				scope[targetingEntity] = scope[targetingEntity] || []
				metaInformation[targetingEntity] = metaInformation[targetingEntity] || []
				scope[targetingEntity].push(_id)
				metaInformation[targetingEntity].push(name)
			})
		})
	}

	// refactor scope to remove duplicates
	Object.keys(scope).forEach((key) => {
		if (Array.isArray(scope[key] && scope[key].length > 0)) {
			scope[key] = [...new Set(scope[key])] // Remove duplicates while preserving array structure
		}
	})

	// convert the 'entityType' array to coma separated string
	scope.entityType = scope?.entityType ? scope?.entityType.join(',') : ''
	// refactor metaInformation to remove duplicates
	Object.keys(metaInformation).forEach((key) => {
		if (Array.isArray(metaInformation[key] && metaInformation[key].length > 0)) {
			metaInformation[key] = [...new Set(metaInformation[key])] // Remove duplicates while preserving array structure
		}
	})

	return { scope, metaInformation }
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
			programDocument.scope = targeting?.scope ? targeting?.scope : {}
			programDocument.metaInformation = targeting?.metaInformation ? targeting?.metaInformation : {}
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

			let resourceDetails = programData?.resource // prepare the program template
			programDocument = {
				...programDocument,
				...{
					resourceType: [common.ROLLOUT_TYPE_PROGRAM],
					language,
					keywords,
					concepts: programData?.concepts ? programData?.concepts : [],
					components: [],
					resourceDetails,
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
					description: resourceDetails?.objective || '',
					createdAt: new Date(),
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
				const signatureNameTag = `signatureTitleName${index}`
				const signatureDesignationTag = `signatureTitleDesignation${index}`
				const signatureImgTag = `signatureImg${index}`
				const imageData = await downloadAndConvertToBase64(certificateData.signature[signatureImgTag])
				const signatureNameElement = $(`#${signatureNameTag}`)
				const signatureDesignationElement = $(`#${signatureDesignationTag}`)
				const signatureImgElement = $(`#${signatureImgTag}`)
				signatureImgElement.attr('xlink:href', utils.escapeXml(imageData))
				signatureNameElement.text(utils.escapeXml(certificateData.signature[signatureImgTag]))
				signatureDesignationElement.text(utils.escapeXml(certificateData.signature[signatureDesignationTag]))
			}

			// update logos
			for (let index = 1; index <= certificateData.logos.no_of_logos; index++) {
				const logoTag = `stateLogo${index}`
				const imageData = await downloadAndConvertToBase64(certificateData.logos[logoTag])
				const logoElement = $(`#${logoTag}`)
				logoElement.attr('xlink:href', utils.escapeXml(imageData))
			}

			// updated svg
			let updatedSvg = $.xml()

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
			// const getSignedUrl = await filesService.getSignedUrl(payloadData, common.CERTIFICATE, loggedInUserId, false)
			const headers = {
				'X-auth-token': userToken,
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
	const certificateBaseTemplateCollection = mongoDb.collection(COLLECTIONS.CERTIFICATE_BASE_TEMPLATE)
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
	const certificateTemplateCollection = mongoDb.collection(COLLECTIONS.CERTIFICATE_TEMPLATE)
	const result = await certificateTemplateCollection.insertOne(certificateDocument)

	// Validate the result of the template creation
	if (!result || !result.insertedId) {
		throw new Error(`Failed to insert the template into the ${COLLECTIONS.CERTIFICATE_TEMPLATE} collection.`)
	}
	// update the solution with the certificate template id
	const solutionTemplateCollection = mongoDb.collection(COLLECTIONS.SOLUTIONS)
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
	const projectTemplateCollection = mongoDb.collection(COLLECTIONS.TEMPLATES)
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
		const response = await axios.get(templateUrl)
		if (response.status === 200) {
			return {
				success: true,
				result: response.data,
			}
		} else {
			throw new Error(`Unexpected response status: ${response.status}`)
		}
	} catch (error) {
		return Promise.reject(new Error(`Failed to fetch base template: ${error.message}`))
	}
}

/**
 *  download file from cloud and convert it into base64
 * @method
 * @name downloadAndConvertToBase64
 * @param {String} templateUrl - cloud path to download
 */
async function downloadAndConvertToBase64(url) {
	try {
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

		// Get the content type (e.g., image/jpeg) from the response headers
		const contentType = response.headers['content-type']

		// Create the Base64 Data URL
		const base64DataUrl = `data:${contentType};base64,${base64}`

		return base64DataUrl
	} catch (error) {
		console.error('Error downloading or converting file:', error.message)
		throw error
	}
}

/**
 * Publish the Program
 * @name publishProjectTemplates
 * @param {Object} programData - Program template data
 * @returns {Object} - Response of Program creation
 */
const publishProgram = function async(programData) {
	return new Promise(async (resolve, reject) => {
		const result = { success: false, templateId: null, error: null }
		try {
			const userToken = programData.userToken
			// Format the program template
			let formattedTemplate = await formatProgramTemplate(programData)
			if (!formattedTemplate.success) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.programDocument
			// fetch the resource details to create solutions
			const resourceDetailsCreate = programData.resource
			delete template.resourceDetails
			const resourceStatus = await rolloutQueries.findOne(
				{
					id: resourceDetailsCreate?.rolloutId,
				},
				{ attributes: ['status', 'published_id'] }
			)
			const programScope = template.scope

			let result = {}
			let programId = template?._id ? ObjectId(template?._id) : null

			// Insert the template into the database
			const programsCollection = mongoDb.collection(COLLECTIONS.PROGRAMS)
			// if program is already created , update scope , start and end dates  else create a new program
			if (programId) {
				let updateData = _.omit(template, '_id', 'published_id')

				result = await programsCollection.updateOne(
					{ _id: template?._id },
					{
						$set: updateData,
					}
				)

				programId = template?._id
			} else {
				result = await programsCollection.insertOne(template)
				// Validate the result of the template creation
				if (!result || !result.insertedId) {
					throw new Error('Failed to insert the template into the database.')
				}
				programId = result.insertedId
			}
			let solutions = []

			if (
				resourceStatus?.status == common.ROLLOUT_STATUS_ROLLED_OUT &&
				resourceStatus?.published_id != undefined
			) {
				const updateTemplate = {
					scope: formattedTemplate.programDocument.scope,
					endDate: formattedTemplate.programDocument.endDate,
					startDate: formattedTemplate.programDocument.startDate,
				}
				const solutionsCollection = mongoDb.collection(COLLECTIONS.SOLUTIONS)
				result = await solutionsCollection.updateOne(
					{ projectTemplateId: ObjectId(resourceDetailsCreate?.published_id) },
					{
						$set: updateTemplate,
					}
				)

				solutions.push({ rolloutId: resourceDetailsCreate?.rolloutId })
			} else {
				let duplicateResource = await duplicateResources(resourceDetailsCreate, programData.created_by)
				solutions = await createSolutions(
					duplicateResource,
					{
						_id: programId,
						scope: programScope,
						externalId: template.externalId,
						name: template.name,
						description: template.description ? template.description : '',
						end_date: template.endDate,
						start_date: template.startDate,
						created_by: programData.created_by,
						orgId: programData.organization_id,
					},
					userToken
				)
				const solutionIds = solutions.map((solution) => solution._id)
				// Update Template with tasks and sequence
				await programsCollection.updateOne(
					{ _id: programId },
					{
						$set: {
							components: solutionIds,
						},
					}
				)
			}

			await rolloutService.publishCallback(programData.id, programId ? programId.toString() : null)
			solutions.forEach(async (solution) => {
				await rolloutService.publishCallback(
					solution.rolloutId,
					solution?._id ? solution?._id.toString() : null,
					solution?.projectTemplateId ? solution?.projectTemplateId.toString() : null
				)
			})

			//return result
			result.success = true
			result.programId = programId

			return resolve(result)
		} catch (error) {
			result.error = `Error: ${error.message}`
			return reject(error)
		}
	})
}
module.exports = {
	publishProjectTemplates,
	publishProject,
	publishProgram,
}

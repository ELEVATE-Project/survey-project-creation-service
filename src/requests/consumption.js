/**
 * name : consumption.js
 * author : Priyanka Pradeep
 * Date : 13-Dec-2024
 * Description : Create data in elevate-project service.
 */
const common = require('@constants/common')
const resourceService = require('@services/resource')
const utils = require('@generics/utils')
const interfaceBaseUrl = process.env.INTERFACE_SERVICE_HOST
const requests = require('@generics/requests')
const endpoints = require('@constants/endpoints')
const MongoClient = require('mongodb').MongoClient
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
module.exports = {
	publishProjectTemplates,
	publishProject,
}

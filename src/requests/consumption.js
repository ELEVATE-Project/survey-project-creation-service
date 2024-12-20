/**
 * name : consumption.js
 * author : Priyanka Pradeep
 * Date : 13-Dec-2024
 * Description : Create data in elevate-project service.
 */
const common = require('@constants/common')
const resourceService = require('@services/resource')
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
			console.log(templateData, 'templateData')
			// Format the template
			let formattedTemplate = formatTemplate(templateData)
			if (!formattedTemplate.success) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.template

			// Process Categories
			if (templateData.categories?.length > 0) {
				let categoriesResponse = await processCategories(templateData.categories)
				if (!categoriesResponse.success) {
					throw new Error('FAILED_TO_FETCH_OR_CREATE_CATEGORIES')
				}
				template.categories = categoriesResponse.categories
			}

			// Insert the template into the database
			const templateCollection = mongoDb.collection(COLLECTIONS.TEMPLATES)
			const result = await templateCollection.insertOne(template)

			// Validate the result of the template creation
			if (!result || !result.insertedId) {
				throw new Error('Failed to insert the template into the database.')
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
			result.error = `Error: ${error.message}`
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
			keywords: templateData.keywords ? templateData.keywords.split(',').map((k) => k.trim()) : [],
			isDeleted: false,
			recommendedFor: templateData.recommended_for?.length
				? templateData.recommended_for.map((item) => item.label)
				: [],
			createdBy: templateData.user_id,
			updatedBy: templateData.user_id,
			learningResources: templateData.learning_resources ? convertResources(templateData.learning_resources) : [],
			isReusable: true,
			taskSequence: [], // Initially empty
			deleted: false,
			status: common.PUBLISHED_STATUS,
			externalId: generateExternalId(templateData.title),
			entityType: '',
			metaInformation: {
				goal: '',
				rationale: '',
				primaryAudience: '',
				duration: `${templateData.recommended_duration.number} ${templateData.recommended_duration.duration}`,
				successIndicators: '',
				risks: '',
				approaches: '',
			},
			tasks: [], // Initially empty
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
				throw new Error('Each category must have a label and a value.')
			}
			return {
				label: category.label,
				value: category.value,
				formattedName: formatCategoriesName(category.value),
				externalId: category.value.replace(/_/g, '').toLowerCase(),
			}
		})

		// Fetch existing categories by externalId
		const existingCategories = await categoriesCollection
			.find({ externalId: { $in: formattedCategories.map((cat) => cat.externalId) } })
			.toArray()
		const existingExternalIds = new Set(existingCategories.map((cat) => cat.externalId))

		// Filter out categories that already exist
		const newCategories = formattedCategories
			.filter((cat) => !existingExternalIds.has(cat.externalId))
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
			const result = await categoriesCollection.insertMany(newCategories)
			newCategories.forEach((category, index) => {
				category._id = result.insertedIds[index]
				existingExternalIds.add(category.externalId)
			})
		}

		// Map all categories to the response format
		const processedCategories = formattedCategories.map((category) => {
			const existing = existingCategories.find((cat) => cat.externalId === category.externalId)
			if (existing) {
				return {
					_id: existing._id,
					externalId: existing.externalId,
					name: existing.name,
				}
			} else {
				const newCategory = newCategories.find((cat) => cat.externalId === category.externalId)
				return {
					_id: newCategory._id,
					externalId: newCategory.externalId,
					name: newCategory.name,
				}
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
				externalId: generateExternalId(task.name),
				type: task.type,
				isDeleted: !task.is_mandatory,
				isDeletable: !task.is_mandatory,
				sequenceNumber: task.sequence_no,
				projectTemplateId: templateId,
				projectTemplateExternalId: templateExternalId,
				hasSubTasks: !!task.children?.length,
				learningResources: convertResources(task.learning_resources || []),
				parentId,
				deleted: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			}

			// Create the task
			const taskCreationRes = await taskCollection.insertOne(taskData)
			// Validate the insertion result
			if (!taskCreationRes || !taskCreationRes.insertedId) {
				result.error = `Failed to insert task: ${task.name}`
				return result
			}

			const taskId = taskCreationRes.insertedId
			taskIds.push(taskId)
			externalIds.push(taskData.externalId)

			// Recursively handle child tasks
			if (task.children?.length) {
				const childTaskResult = await createTasks(task.children, templateId, templateExternalId, taskId)

				// Validate the child task creation
				if (!childTaskResult.success) {
					result.error = `Failed to create child tasks for task: ${task.name}. Error: ${childTaskResult.error}`
					return result
				}

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
 * Format category Name
 * @name formatCategoriesName
 * @param {String} value - category
 * @returns {String} - Category
 */
function formatCategoriesName(value) {
	return value
		.replace(/_/g, ' ') // Replace underscores with spaces
		.replace(/\b\w/g, (char) => char.toUpperCase()) // Capitalize the first letter of each word
		.trim() // Ensure no leading or trailing spaces
}

/**
 * Generate externalId from title
 * @name generateExternalId
 * @param {String} title - title
 * @returns {String} - ExternalId
 */

function generateExternalId(title) {
	console.log(title, 'title')
	const words = title.split(/[\s-]+/)
	const abbreviation = words.map((word) => (word[0] || '').toUpperCase()).join('')
	const uniqueSuffix = Date.now()
	return `${abbreviation}-${uniqueSuffix}`
}

/**
 * Convert Learning Resource
 * @name convertResources
 * @param {Array} resources - learning resource data
 * @returns {Object} - Response contains formatted learning resource
 */
const convertResources = (resources) =>
	resources
		.filter((resource) => resource.url) // Ensure `url` exists
		.map((resource) => ({
			name: resource.name || 'resource',
			link: resource.url,
			app: process.env.CONSUMPTION_SERVICE,
			id: resource.url.split('/').pop(), // Extract the last part of the URL
		}))

/**
 * Assign sequence number for task
 * @name assignSequenceNumbers
 * @returns {Object} - Response contains task object
 */
const assignSequenceNumbers = (tasks) => {
	let sequenceCounter = 1
	return tasks.map((task) => {
		if (!task.sequence_no) {
			task.sequence_no = sequenceCounter++
		}
		return task
	})
}

/**
 * Publish the Program
 * @name publishProjectTemplates
 * @param {Object} templateData - Project template data
 * @returns {Object} - Response of template creation
 */
const publishProgram = function (templateData) {
	return new Promise(async (resolve, reject) => {
		const result = { success: false, templateId: null, error: null }
		try {
			console.log(templateData, 'templateData')
			// Format the template
			let formattedTemplate = formatTemplate(templateData)
			if (!formattedTemplate.success) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.template

			// Process Categories
			if (templateData.categories?.length > 0) {
				let categoriesResponse = await processCategories(templateData.categories)
				if (!categoriesResponse.success) {
					throw new Error('FAILED_TO_FETCH_OR_CREATE_CATEGORIES')
				}
				template.categories = categoriesResponse.categories
			}

			// Insert the template into the database
			const templateCollection = mongoDb.collection(COLLECTIONS.TEMPLATES)
			const result = await templateCollection.insertOne(template)

			// Validate the result of the template creation
			if (!result || !result.insertedId) {
				throw new Error('Failed to insert the template into the database.')
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
			result.error = `Error: ${error.message}`
			return reject(error)
		}
	})
}

module.exports = {
	publishProjectTemplates,
}

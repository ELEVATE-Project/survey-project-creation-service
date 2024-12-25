/**
 * name : consumption.js
 * author : Priyanka Pradeep
 * Date : 13-Dec-2024
 * Description : Create data in elevate-project service.
 */
const common = require('@constants/common')
const resourceService = require('@services/resource')
const rolloutService = require('@services/rollouts')
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectID
const _ = require('lodash')
const utils = require('@generics/utils')
const axios = require('axios')
const cheerio = require('cheerio')
let fs = require('fs')
const path = require('path')
const request = require('request')
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
	PROJECT_TEMPLATES: 'projectTemplates',
	TASKS: 'projectTemplateTasks',
	PROGRAMS: 'programs',
	SOLUTIONS: 'solutions',
	CERTIFICATE_TEMPLATE: 'certificateTemplates',
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
			const templateCollection = mongoDb.collection(COLLECTIONS.PROJECT_TEMPLATES)
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

const createSolutions = async (resourceDetails, programDetails) => {
	try {
		let solutionsToCreate = []
		let solutionCertificateMap = []
		resourceDetails.forEach((resource) => {
			const solutionTemplate = {
				resourceType: [common.SOLUTIONS_RESOURCE_TYPE[resource.type]],
				language: resource?.languages ? resource?.languages.map((language) => language.label) : [],
				keywords: resource?.keywords
					? Array.isArray(resource?.keywords)
						? resource?.keywords
						: resource?.keywords.split(',')
					: [],
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
				entityType: common.SOLUTIONS_ENTITY_TYPE[resource.type]
					? common.SOLUTIONS_ENTITY_TYPE[resource.type]
					: resource?.entityType
					? resource?.entityType
					: null,
				type: common.SOLUTIONS_TYPE[resource.type] ? common.SOLUTIONS_TYPE[resource.type] : null,
				subType: common.SOLUTIONS_TYPE[resource.type] ? common.SOLUTIONS_TYPE[resource.type] : null,
				isReusable: false,
				externalId: utils.generateUniqueId(),
				programId: programDetails._id,
				programName: programDetails.name,
				programDescription: programDetails.description,
				status: common.STATUS_ACTIVE.toLowerCase(),
				updatedAt: new Date(),
				createdAt: new Date(),
				scope: programDetails.scope,
				projectTemplateId: null,
				updatedBy: 1,
				endDate: programDetails.end_date,
				startDate: programDetails.start_date,
			}

			// map resource externalId and certificate Data if it has certificate data
			if (
				resource?.certificate &&
				typeof resource?.certificate === 'object' &&
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
				const found = createdSolutions.find((solution) => solution.externalId == solutionMap.externalId)
				insertCertificateTemplate(found.certificate, found._id, programDetails._id)
			})
		}

		return createdSolutions
	} catch (error) {
		console.log(error)
	}
}

const duplicateResources = async (resourceDetails) => {
	let projectTemplateIds = []
	let solutionTemplateIds = []
	resourceDetails.forEach((resource) => {
		if (resource.type == common.PROJECT) projectTemplateIds.push(ObjectId(resource._id))
		else solutionTemplateIds.push(ObjectId(resource._id))
	})

	// handling only project creation now. Make changes here for observation , survey etc...
	if (projectTemplateIds.length > 0) {
		const projectsCollection = mongoDb.collection(COLLECTIONS.PROJECT_TEMPLATES)
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
		let templateProjectsIdMap = {}
		let templateProjects = []
		let templateTaskIds = []
		let duplicateTasks = []

		//taskMap = {
		// 	projectTaskId : duplicateProjectTaskId
		// }
		let taskMap = {}

		if (projectTemplates) {
			projectTemplates.forEach((project) => {
				project.externalId = project.externalId + common.SUFFIX_CHILD
				delete project._id
				project.updatedAt = new Date()
				project.createdAt = new Date()
				project.isReusable = false
				templateProjectsTaskMap[project.externalId] = project.tasks
				templateProjectsIdMap[project.externalId] = project.rolloutId
				templateProjects.push(project)
			})

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

			projectsTasksDetails.forEach((projectTask) => {
				projectTask.externalId = utils.generateUniqueId()
				taskMap[projectTask._id] = projectTask.externalId
				projectTask.updatedAt = new Date()
				projectTask.createdAt = new Date()
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

			templateProjects.forEach((project) => {
				let projectTasks = []
				project.tasks.forEach((task) => {
					projectTasks.push(taskMap[task])
				})
				project.tasks = projectTasks
			})

			await projectsCollection.insertMany(templateProjects)
		}

		const projectTemplatesAfterInsert = await projectsCollection
			.find({
				externalId: {
					$in: templateProjects.map((projects) => projects.externalId),
				},
			})
			.toArray()

		// Add a new 'type' key to each project
		const updatedProjectTemplates = projectTemplatesAfterInsert.map((project) => ({
			...project, // Spread the existing project fields
			type: common.PROJECT,
			resource_id: templateProjectsIdMap[project.externalId],
		}))

		return [...updatedProjectTemplates]
	}
}

/**
 * Format Program Template
 * @name formatProgramTemplate
 * @param {Object} templateData - Program template data
 * @returns {Object} - Response contains formatted template
 */
const formatProgramTemplate = (templateData) => {
	try {
		let language = templateData?.language
			? templateData?.language
			: templateData?.resource
			? templateData?.resource.flatMap((resource) => {
					return resource.languages.map((language) => {
						return language.label
					})
			  })
			: []
		language = [...new Set(language)]
		let keywords = templateData?.keywords
			? templateData?.keywords
			: templateData?.resource
			? templateData?.resource.flatMap((resource) => {
					return resource.keywords.split(',')
			  })
			: []
		keywords = [...new Set(keywords)]

		const resourceDetails = templateData?.resource
			.map((resource) => {
				return {
					_id: ObjectId(resource.published_id),
					type: resource.type,
				}
			})
			.filter((published_id) => published_id !== null && published_id !== undefined)
		let scope = {
			roles: [],
			entityType: [],
		}
		let metaInformation = {
			recommendedFor: [],
		}
		if (templateData?.targeting_criteria) {
			templateData?.targeting_criteria.forEach((targeting) => {
				const targeting_entity = targeting?.entity_targeting?.value

				if (!scope.entityType.includes(targeting_entity)) scope.entityType.push(targeting_entity)
				if (targeting?.roles) {
					targeting.roles.forEach((role) => {
						if (!scope.roles.includes(role.value)) scope.roles.push(role.value)
						if (!metaInformation.recommendedFor.includes(role.label))
							metaInformation.recommendedFor.push(role.label)
					})
				} else {
					scope.roles = []
					metaInformation.recommendedFor = []
				}
				targeting[targeting_entity].forEach((target) => {
					if (scope[targeting_entity] == undefined) scope[targeting_entity] = []
					if (metaInformation[targeting_entity] == undefined) metaInformation[targeting_entity] = []
					metaInformation[targeting_entity].push(target.name)
					scope[targeting_entity].push(target._id)
				})
			})
		}

		let template = {
			scope,
			metaInformation,
			resourceType: [common.ROLLOUT_TYPE_PROGRAM],
			language,
			keywords,
			concepts: templateData?.concepts ? templateData?.concepts : [],
			components: [],
			resourceDetails,
			isAPrivateProgram: false,
			isDeleted: false,
			requestForPIIConsent: templateData?.requestForPIIConsent ? true : false,
			rootOrganisations: [
				templateData?.rootOrganisations ? templateData?.rootOrganisations : templateData?.organization?.id,
			],
			createdFor: [templateData?.createdFor ? templateData?.createdFor : templateData?.organization?.id],
			deleted: false,
			status: common.STATUS_ACTIVE.toLowerCase(),
			owner: templateData?.created_by,
			createdBy: templateData?.created_by,
			updatedBy: templateData?.created_by,
			externalId: generateExternalId(templateData?.title),
			name: templateData?.title.trim(),
			description: templateData?.description ? templateData?.description : '',
			updatedAt: new Date(),
			createdAt: new Date(),
			endDate: new Date(templateData?.end_date),
			startDate: new Date(templateData?.start_date),
		}

		return { success: true, template }
	} catch (error) {
		console.error('Error in formatTemplate:', error.message)
		return { success: false, error: error.message }
	}
}

// function to replace special charecters
const escapeXml = (unsafe) => {
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

/**
 * create svg template by editing base template.
 * @method
 * @name createSvg
 * @param {Object} certificateData - Certificate data for upload
 */

async function createSvg(certificateData) {
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
			issuerNameElement.text(escapeXml(certificateData.issuer))

			// update signature
			for (let index = 1; index <= certificateData.signature.no_of_signature; index++) {
				const signatureNameTag = `signatureTitleName${index}`
				const signatureDesignationTag = `signatureTitleDesignation${index}`
				const signatureImgTag = `signatureImg${index}`
				const imageData = await downloadAndConvertToBase64(certificateData.signature[signatureImgTag])
				const signatureNameElement = $(`#${signatureNameTag}`)
				const signatureDesignationElement = $(`#${signatureDesignationTag}`)
				const signatureImgElement = $(`#${signatureImgTag}`)
				signatureImgElement.attr('xlink:href', escapeXml(imageData))
				signatureNameElement.text(escapeXml(certificateData.signature[signatureImgTag]))
				signatureDesignationElement.text(escapeXml(certificateData.signature[signatureDesignationTag]))
			}

			// update logos
			for (let index = 1; index <= certificateData.logos.no_of_logos; index++) {
				const logoTag = `stateLogo${index}`
				const imageData = await downloadAndConvertToBase64(certificateData.logos[logoTag])
				const logoElement = $(`#${logoTag}`)
				logoElement.attr('xlink:href', escapeXml(imageData))
			}

			// updated svg
			let updatedSvg = $.xml()

			const uniqueId = utils.generateUniqueId() //generate a unique id for folder
			let fileName = `./certificate_template_${uniqueId}.svg` //create a unique file name
			const mainPath = path.join(__dirname, `../temp/certificate/`) //temporary folder path for certificate template
			let dirPath = path.join(mainPath, `${uniqueId}/`) //create a directory path
			fs.mkdirSync(dirPath, { recursive: true }) //create directory
			fs.writeFileSync(path.join(dirPath, fileName), updatedSvg, { encoding: 'utf8' }) //create file
			// create a file upload payload
			let payloadData = {
				cert: {
					files: [fileName],
				},
				ref: common.CERTIFICATE,
			}
			// generate signed url
			const getSignedUrl = await filesService.getSignedUrl(
				payloadData,
				common.CERTIFICATE_TEMPLATE,
				'system',
				false
			)
			if (!getSignedUrl.result) {
				throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
			}

			if (!getSignedUrl.result) {
				throw new Error('FAILED_TO_GENERATE_SIGNED_URL')
			}

			const fileUploadUrl = getSignedUrl.result['cert']['files'][0].url
			let uploadedFilePath = getSignedUrl.result['cert']['files'][0].file
			const fileData = fs.readFileSync(path.join(dirPath, fileName))
			//upload file
			const fileUploadToSingedUrl = await request({
				url: fileUploadUrl,
				method: 'put',
				headers: {
					'Content-Type': 'application/multipart/form-data',
				},
				body: fileData,
			})
			console.log('fileUploadToSingedUrl : ', fileUploadToSingedUrl.status)
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

async function insertCertificateTemplate(certificateData, solutionId, programId) {
	const filePath = await createSvg(certificateData)
	const certificateDocument = {
		status: common.STATUS_ACTIVE.toLowerCase(),
		deleted: false,
		solutionId,
		programId,
		createdAt: new Date(),
		updatedAt: new Date(),
		templateUrl: filePath,
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
	// Insert the template into the database
	const solutionTemplateCollection = mongoDb.collection(COLLECTIONS.SOLUTIONS)
	const resultUpdateSolution = await solutionTemplateCollection.updateOne(
		({ _id: solutionId },
		{
			$set: {
				certificateTemplateId: result.insertedId,
			},
		})
	)
	// Validate the result of the template creation
	if (!resultUpdateSolution) {
		throw new Error(`Failed to update the template into the ${COLLECTIONS.SOLUTIONS} collection.`)
	}

	return true
}
// function to recursively delete folder after upload
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
// Function to fetch data information from cloud using downloadable Url
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

// download file from cloud and convert it into base64
async function downloadAndConvertToBase64(url) {
	try {
		// Download the image file as a binary buffer
		const response = await axios({
			url,
			method: 'GET',
			responseType: 'arraybuffer', // Ensures we receive raw binary data
			timeout: 40000,
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

// async function createResourceRollouts()

/**
 * Publish the Program
 * @name publishProjectTemplates
 * @param {Object} programData - Program template data
 * @returns {Object} - Response of Program creation
 */
const publishProgram = function (programData) {
	return new Promise(async (resolve, reject) => {
		const result = { success: false, templateId: null, error: null }
		try {
			// Format the template
			let formattedTemplate = formatProgramTemplate(programData)
			if (!formattedTemplate.success) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.template
			const resourceDetailsCreate = template.resourceDetails.map(
				(resource) => resource.processType == common.ROLLOUT_PROCESS_TYPE_CREATE
			)
			const resourceDetailsUpdate = template.resourceDetails.map(
				(resource) => resource.processType == common.ROLLOUT_PROCESS_TYPE_UPDATE
			)
			const programScope = template.scope
			delete template.resourceDetails
			let result = {}
			let programId
			// Insert the template into the database
			const programsCollection = mongoDb.collection(COLLECTIONS.PROGRAMS)
			if (programData.processType == common.ROLLOUT_PROCESS_TYPE_UPDATE) {
				const updateTemplate = {
					scope: formattedTemplate.template.scope,
					endDate: formattedTemplate.template.endDate,
					startDate: formattedTemplate.template.startDate,
				}

				result = await programsCollection.updateOne(
					{ _id: programData._id },
					{
						$set: updateTemplate,
					}
				)

				programId = programData._id
			} else {
				result = await programsCollection.insertOne(template)
				// Validate the result of the template creation
				if (!result || !result.insertedId) {
					throw new Error('Failed to insert the template into the database.')
				}
				programId = result.insertedId
			}

			if (resourceDetailsCreate.length > 0) {
				const duplicateResource = await duplicateResources(resourceDetailsCreate)
				const solutions = await createSolutions(duplicateResource, {
					_id: programId,
					scope: programScope,
					externalId: template.externalId,
					name: template.name,
					description: template.description ? template.description : '',
					end_date: template.endDate,
					start_date: template.startDate,
				})
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
				await rolloutService.publishCallback(programData.id, programId.toString())
				duplicateResource.forEach(async (resource) => {
					await rolloutService.publishCallback(resource.resource_id, resource._id.toString())
				})
			}

			if (resourceDetailsUpdate.length > 0) {
				const solutionCollection = mongoDb.collection(COLLECTIONS.SOLUTIONS)
				resourceDetailsUpdate.forEach(async (resource) => {
					let scope = {
						roles: [],
						entityType: [],
					}
					if (resource?.targeting_criteria) {
						resource?.targeting_criteria.forEach((targeting) => {
							const targeting_entity = targeting?.entity_targeting?.value

							if (!scope.entityType.includes(targeting_entity)) scope.entityType.push(targeting_entity)
							if (targeting?.roles) {
								targeting.roles.forEach((role) => {
									if (!scope.roles.includes(role.value)) scope.roles.push(role.value)
									if (!metaInformation.recommendedFor.includes(role.label))
										metaInformation.recommendedFor.push(role.label)
								})
							} else {
								scope.roles = []
								metaInformation.recommendedFor = []
							}
							targeting[targeting_entity].forEach((target) => {
								if (scope[targeting_entity] == undefined) scope[targeting_entity] = []
								if (metaInformation[targeting_entity] == undefined)
									metaInformation[targeting_entity] = []
								metaInformation[targeting_entity].push(target.name)
								scope[targeting_entity].push(target._id)
							})
						})
					} else {
						scope = formattedTemplate.scope
					}

					await solutionCollection.updateOne(
						{ _id: resource.published_id },
						{
							$set: scope,
						}
					)
				})
			}

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
	publishProgram,
}

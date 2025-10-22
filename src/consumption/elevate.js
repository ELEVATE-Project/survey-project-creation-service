const { projectsMongoDBUrl, surveyMongoDBUrl } = require('@consumption/config')

const projectService = require('@services/projects')
const _ = require('lodash')
const utils = require('@generics/utils')
const common = require('@constants/common')
const MongoDBConnection = require('@configs/mongoConnection')
const resourceService = require('@services/resource')
const rolloutService = require('@services/rollouts')
const targetingHelpers = require('@helpers/targetingCriteria')
const entityModelMappingQuery = require('@database/queries/entityModelMapping')
const { Op } = require('sequelize')
const requests = require('@generics/requests')
const responseCode = require('@generics/http-status')
const rolloutQueries = require('@database/queries/rollouts')
const { ObjectId } = require('mongodb')
const fs = require('fs')
const axios = require('axios')
const cheerio = require('cheerio')
const path = require('path')
const certificateBaseTemplateQueries = require('@database/queries/certificateBaseTemplate')
const userRequests = require('@requests/user')
const interfaceRequests = require('@requests/interface')
let projectsMongoConnection = null
let mongoConnection = null
let scopeKeys = {}
let socketInUse = false

// Define the mongoDb collection names used
const COLLECTIONS_MAP = new Map(
	Object.entries({
		CATEGORIES: 'projectCategories',
		TEMPLATES: 'projectTemplates',
		TASKS: 'projectTemplateTasks',
		PROGRAMS: 'programs',
		SOLUTIONS: 'solutions',
		CERTIFICATE_TEMPLATE: 'certificateTemplates',
		CERTIFICATE_BASE_TEMPLATE: 'certificateBaseTemplates',
		USER_EXTENSIONS: 'userExtensions',
		ORGANIZATION_EXTENSION: 'organizationExtension',
	})
)

/**
 * To connect with the mongoDB with the given url
 * @name connectMongo
 * @param {Object} url - mongo url as returned from config
 * @returns {Object} - Connection Object
 */
const connectMongo = async (url) => {
	try {
		mongoConnection = new MongoDBConnection(url)
		await mongoConnection.connect() // This returns the db, but it's not stored
		// Get the database instance
		return mongoConnection.getDb()
	} catch (error) {
		throw new Error('Error in mongo connection.')
	}
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
			tenantId: templateData.tenant_code,
			orgId: templateData.organization_code,
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
			entityType: templateData?.entityType || '',
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
async function processCategories(categories, orgCode, tenantCode) {
	try {
		// Fetch a specific collection
		const categoriesCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('CATEGORIES'))

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
			existingCategories = await categoriesCollection
				.find({ externalId: { $in: externalIds }, tenantId: tenantCode })
				.toArray()
		}

		const existingExternalIds = [...new Set(existingCategories.map((cat) => cat.externalId))]

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
				tenantId: tenantCode,
				orgId: orgCode,
				createdAt: new Date(),
				updatedAt: new Date(),
			}))

		// Insert only new categories
		if (newCategories.length > 0) {
			const { insertedIds } = await categoriesCollection.insertMany(newCategories)
			newCategories.forEach((category, index) => {
				category._id = insertedIds[index]
				existingExternalIds.push(category.externalId)
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
 * Converts the recommended roles for projects based on the consumption service type.
 * @name convertRecommendedRolesForProjects
 * @param {Array} recommendedFor - An array of objects containing label and value for recommended roles.
 * @returns {Object} The result object containing success status and recommended roles.
 */
async function convertRecommendedRolesForProjects(recommendedFor) {
	try {
		const recommendedRoles = recommendedFor?.length
			? recommendedFor.filter((item) => item?.label).map((item) => item.label)
			: []

		return { success: true, recommendedRoles }
	} catch (error) {
		return { success: false, error: `Failed to process recommeded for: ${error.message}` }
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
 * Create Task
 * @name createTasks
 * @param {Object} tasks - task data
 * @param {String} templateId - template Id
 * @param {String} templateExternalId - template externaldId
 * @param {String} parentId - parentId
 * @returns {Object} - Response contains task data
 */
async function createTasks(tasks, templateId, templateExternalId, parentId = null, organizationCode, tenantCode) {
	const result = { success: false, taskIds: [], externalIds: [], error: null }
	try {
		const taskCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('TASKS'))
		const taskIds = []
		const externalIds = []

		for (const task of tasks) {
			// Format the task data
			let taskData = {
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
				orgId: organizationCode,
				tenantId: tenantCode,
				createdAt: new Date(),
				updatedAt: new Date(),
			}
			//if task type reflection add link and buttonLabel in task metaInformation
			if (task.type === common.TASK_TYPE_REFLECTION) {
				taskData.metaInformation = {
					redirectLink: task.link,
					buttonLabel: common.START_REFLECTION,
				}
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
					organizationCode,
					tenantCode
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
 * Fetch external entities from respective service
 * @name fetchExternalEntities
 * @param {Object} apiData - task data
 * @param {Array} dataToFetch - List of entities to fetch
 * @param {String} entityType - Type of the entity
 * @param {String} tenantCode - tenant code of the entities
 * @returns {Array} - Array of entity names
 */
const fetchExternalEntities = async (apiData, dataToFetch = [], entityType, tenantCode) => {
	let result = []
	try {
		if (apiData && Object.keys(apiData) && dataToFetch.length > 0) {
			const hostEnvKey = apiData.service.replace(/-/g, '_').toUpperCase()
			const host = process.env?.[`${hostEnvKey}_SERVICE_HOST`]
			const serviceName = process.env?.[`${hostEnvKey}_SERVICE_NAME`]
			const baseUrl = utils.buildUrl(host, serviceName)
			const endPoint = utils.buildUrl(baseUrl, apiData.endPointService)
			const bodyData = {
				query: {
					_id: {
						$in: dataToFetch,
					},
					entityType: entityType,
					tenantId: tenantCode,
				},
				projection: ['_id', 'metaInformation.name', 'entityType'],
				mongoIdKeys: ['_id'],
			}

			const response = await requests.post(endPoint, bodyData, '', true, 'internal-access-token')
			if (response.status == responseCode.ok) {
				result = response?.result || []
			}
		}

		return result
	} catch (error) {
		console.log(error)
		return result
	}
}

/**
 * Process targeting criteria
 * @name processTargetingCriteria
 * @param {Object} targetingData - Program template data
 * @returns {Object} - Response contains scope and metaInformation
 */
const processTargetingCriteria = async (targetingData, organizationCode, tenantCode) => {
	try {
		let scope = {}
		// add organization into the scope by default
		scope[`${common.SCOPE_ELEMENT_ORGANIZATIONS}`] = [organizationCode]
		let mandatoryKeys = []
		// iterate through the scope keys and create empty array for each key
		// also track the mandatory keys
		for (let scopeElement of Object.keys(scopeKeys)) {
			scope[scopeElement] = []
			if (scopeKeys[scopeElement]?.mandatory) {
				mandatoryKeys.push(scopeElement)
			}
		}

		let metaInformation = {}
		const metaInformationKeys = [
			...new Set(process.env.PROGRAM_META_INFO_KEYS.split(',').map((key) => key.toLowerCase())),
		]
		const metaLocalMap = {
			professional_role: 'role',
		}

		if (targetingData && Object.keys(targetingData).length > 0 && scope && Object.keys(scope).length > 0) {
			// Iterate through each targeting criterion
			for (let i = 0; i < targetingData.length; i++) {
				const targeting = targetingData[i]
				let skipTargeting = false // flag to skip further processing if 'ALL' is found
				for (let eachTargeting of Object.keys(targeting)) {
					const target = targeting?.[eachTargeting] || null
					if (!Object.keys(scope).includes(eachTargeting)) scope[eachTargeting] = []
					// check if the current scope already has 'ALL' keyword and set the flag
					if (
						scope[eachTargeting] == common.TARGETING_ALL ||
						scope[eachTargeting].includes(common.TARGETING_ALL)
					) {
						skipTargeting = true
					}
					// if the particular targeting has 'ALL' keyword, ignore the processing
					if (!skipTargeting) {
						if (target && typeof target == common.STRING) {
							// if the target is string , possibly we are expecting the _id of the entity.
							// Hence push it directly making sure the value is unique
							if (!scope[eachTargeting].includes(target)) {
								if (scope[eachTargeting] == common.TARGETING_ALL) {
									scope[eachTargeting] = [common.TARGETING_ALL] // if targeting is all , set the array as ["ALL"]
								} else {
									scope[eachTargeting].push(target)
								}
							}
						} else if (target && Array.isArray(target) && target.length > 0) {
							// if any of the element is ALL , record only ALL
							if (target.includes(common.TARGETING_ALL)) {
								scope[eachTargeting] = [common.TARGETING_ALL] // if targeting is all , set the array as ["ALL"]
							} else {
								// if the target is an array , iterate through each element
								target.forEach((targetEntity) => {
									// if the element inside array is string , possibly we are expecting the _id of the entity.
									// Hence push it directly making sure the value is unique
									if (typeof targetEntity == common.STRING)
										if (!scope[eachTargeting].includes(targetEntity))
											scope[eachTargeting].push(targetEntity)
									if (typeof targetEntity == common.OBJECT) {
										// if the element inside array is an object.
										// check for _id or id within the object
										const id = targetEntity?._id || targetEntity?.id || null
										if (id && !scope[eachTargeting].includes(targetEntity))
											scope[eachTargeting].push(targetEntity)
									}
								})
							}
						} else if (target && typeof target == common.OBJECT && Object.keys(target).length > 0) {
							// if the target is an object.
							// check for _id or id within the object.
							const id = target?._id || target?.id || null
							if (id && !scope[eachTargeting].includes(target)) scope[eachTargeting].push(target)
						}
					}
				}
			}

			const entityTypes = await entityModelMappingQuery.findEntityTypesAndEntities(
				{
					model: common.MODEL_NAMES['TARGETING'],
					status: common.STATUS_ACTIVE,
				},
				organizationCode,
				tenantCode,
				['id', 'value', 'label', 'config']
			)
			if (entityTypes && entityTypes.length > 0) {
				const filteredEntityTypes = utils.removeDefaultOrgEntityTypes(entityTypes, organizationCode)

				async function processMetaInformation() {
					const acc = {}
					for (const metaKey of metaInformationKeys) {
						const find = filteredEntityTypes.find((entity) => entity.value == metaKey)
						if (find && Object.keys(find).length > 0) {
							const exEntity = await fetchExternalEntities(
								find?.config?.api,
								scope?.[metaKey],
								find?.value || metaKey,
								tenantCode
							)
							const key = metaLocalMap?.[metaKey] ? metaLocalMap[metaKey] : metaKey
							acc[key] = exEntity
								.map((ent) => ent?.['metaInformation.name'])
								.filter((name) => name != null)
						}
					}
					return acc
				}

				metaInformation = await processMetaInformation()
			}
		}
		if (mandatoryKeys.length > 0) {
			for (const key of mandatoryKeys) {
				if (!scope[key] || scope[key].length == 0) {
					scope[key] = [common.TARGETING_ALL]
				}
			}
		}
		if (scope) {
			scope = Object.fromEntries(
				Object.entries(scope).filter(([key, value]) =>
					Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined
				)
			)
		}
		return { scope, metaInformation, success: true }
	} catch (error) {
		console.log('Error in creating targeting : ', error)
		return {
			success: false,
			error,
		}
	}
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
			const targeting = await processTargetingCriteria(
				programData?.targeting_criteria,
				programData.organization_code,
				programData.tenant_code
			)
			if (!targeting?.success) {
				return {
					success: false,
					error: targeting?.error,
				}
			}
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
					orgId: programData.organization_code,
					tenantId: programData.tenant_code,
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
 * Publish the project template
 * @name publishProjectTemplates
 * @param {Object} templateData - Project template data
 * @returns {Object} - Response of template creation
 */
const publishProjectTemplates = function (templateData) {
	return new Promise(async (resolve, reject) => {
		const result = { success: false, templateId: null, error: null }
		try {
			const requiredKeys = ['id', 'tenant_code', 'organization_code']

			const hasAllRequiredKeys = requiredKeys.every((key) => key in templateData)

			if (Object.keys(templateData).length <= 0 || !hasAllRequiredKeys) {
				throw new Error('FAILED_TO_FETCH_PROJECT')
			}

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

			// Format the template
			let formattedTemplate = formatTemplate({ ...projectData })
			if (!formattedTemplate.success || !formattedTemplate?.template) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.template

			projectsMongoConnection = projectsMongoConnection
				? projectsMongoConnection
				: await connectMongo(projectsMongoDBUrl)
			// Fetch Org Policies
			const orgPolicies = await fetchOrgPolicies(
				templateData.organization_code,
				templateData.tenant_code,
				projectsMongoConnection
			)

			if (orgPolicies.success) {
				template.visibility = orgPolicies.policies.visibility
				template.visibleToOrganizations = orgPolicies.policies.visibleToOrganizations
			} else {
				template.policies.visibility = ''
				template.policies.visibleToOrganizations = []
			}

			// Process Categories
			if (projectData.categories?.length > 0) {
				let categoriesResponse = await processCategories(
					projectData.categories,
					projectData.organization_code,
					projectData.tenant_code
				)
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

			// Insert the template into the database
			const templateCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('TEMPLATES'))
			const result = await templateCollection.insertOne(template)

			// Validate the result of the template creation
			if (!result || !result.insertedId) {
				throw new Error('FAILED_TO_CREATE_TEMPLATE')
			}

			const templateId = result.insertedId

			// Process and Create Tasks
			const processedTasks = assignSequenceNumbers(projectData.tasks || [])
			const taskCreationResponse = await createTasks(
				processedTasks,
				templateId,
				template.externalId,
				null,
				projectData.organization_code,
				projectData.tenant_code
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
			await resourceService.publishCallback(projectData.id, templateId.toString())

			//return result
			result.success = true
			result.templateId = templateId
			return resolve(result)
		} catch (error) {
			if (mongoConnection) mongoConnection.disconnect()
			result.error = error.message || error
			return reject(error)
		}
	})
}

/**
 * Fetch Org Policy related keys
 * @name fetchOrgPolicies
 * @param {String} orgCode Organization Code
 * @param {String} tenantcode Tenant Code
 * @param {Object} projectsMongoConnection
 * @param {String} userToken
 * @returns {Object} - Response of policy data
 */
const fetchOrgPolicies = async (orgCode, tenantCode, projectsMongoConnection, userToken = '') => {
	let result = { success: false, policies: {} }
	try {
		const orgDetails = await userRequests.fetchOrg(orgCode, tenantCode, true, userToken)
		let relatedOrgs = []
		if (orgDetails?.success && orgDetails?.data && orgDetails?.data?.result) {
			relatedOrgs = orgDetails?.data?.result?.related_org_details || []
			relatedOrgs = relatedOrgs.length > 0 ? relatedOrgs.map((org) => org.code) : []
		}
		relatedOrgs.push(orgCode)
		relatedOrgs = [...new Set(relatedOrgs)]
		result.policies.visibleToOrganizations = relatedOrgs
		const orgExtensionCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('ORGANIZATION_EXTENSION'))
		const policy = await orgExtensionCollection.findOne({ orgId: orgCode, tenantId: tenantCode })
		if (policy && Object.keys(policy).length > 0) {
			result.policies.visibility = policy?.externalProjectResourceVisibilityPolicy || null
		}

		result.success = true

		if (
			!result?.policies?.visibility ||
			!result?.policies?.visibleToOrganizations ||
			result?.policies?.visibleToOrganizations.length == 0
		) {
			result.success = false
		}
		if (result?.policies?.visibility && result?.policies?.visibility == common.ORG_POLICY_CURRENT) {
			result.success = true
		}

		return result
	} catch (error) {
		result.success = false
		result.error = error.message || error
		return result
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
		const programsCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('PROGRAMS'))
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
	const targeting = await processTargetingCriteria(
		resource?.targeting_criteria,
		resource.organization_code,
		resource.tenant_code
	)
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
 *  Create program template and insert it into mongo
 * @method
 * @name createProgram
 * @param {Object} programTemplate - Program data
 * @return {String} programId - Program _id
 */
async function createProgram(programTemplate) {
	try {
		const programsCollectionName = COLLECTIONS_MAP.get('PROGRAMS')
		const programsCollection = projectsMongoConnection.collection(programsCollectionName)
		// Insert the template into the database
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
					process.env.PROJECT_SERVICE_BASE_URL +
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
 * Check and Insert certificate base template
 * @method
 * @name checkCertificateBaseTemplate
 * @param {Object} baseTemplateDetails - Certificate data for base template creation
 * @returns {Object} result - baseTemplateId
 */
async function checkCertificateBaseTemplate(baseTemplateDetails, orgCode, tenantCode) {
	const certificateBaseTemplateCollection = projectsMongoConnection.collection(
		COLLECTIONS_MAP.get('CERTIFICATE_BASE_TEMPLATE')
	)
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
			tenantId: tenantCode,
			orgId: orgCode,
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
async function insertCertificateTemplate(
	certificateData,
	solutionId,
	programId,
	loggedInUserId,
	userToken,
	orgCode,
	tenantCode
) {
	const svgTemplateCreation = await createSvg(certificateData, loggedInUserId, userToken)
	const baseTemplate = await checkCertificateBaseTemplate(certificateData, orgCode, tenantCode)
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
		tenantId: tenantCode,
		orgId: orgCode,
	}

	// Insert the template into the database
	const certificateTemplateCollection = projectsMongoConnection.collection(
		COLLECTIONS_MAP.get('CERTIFICATE_TEMPLATE')
	)
	const result = await certificateTemplateCollection.insertOne(certificateDocument)

	// Validate the result of the template creation
	if (!result || !result.insertedId) {
		throw new Error(
			`Failed to insert the template into the ${COLLECTIONS_MAP.get('CERTIFICATE_TEMPLATE')} collection.`
		)
	}
	// update the solution with the certificate template id
	const solutionTemplateCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('SOLUTIONS'))
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
		throw new Error(`Failed to update the template into the ${COLLECTIONS_MAP.get('SOLUTIONS')} collection.`)
	}
	// update the template into projectTemplate collection
	const projectTemplateCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('TEMPLATES'))

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
		throw new Error(
			`No document found with solutionId: ${solutionId} in the ${COLLECTIONS_MAP.get('TEMPLATES')} collection.`
		)
	}

	if (resultUpdateProjecTemplate.modifiedCount === 0) {
		throw new Error(
			`Document with solutionId: ${solutionId} was found but not updated in the ${COLLECTIONS_MAP.get(
				'TEMPLATES'
			)} collection.`
		)
	}

	return true
}

/**
 * Create a duplicate solution from the given resource details
 * @name duplicateResources
 * @param {Object} resourceDetails - Object of resource details
 * @param {String} created_by - created by user id
 * @returns {Array} Array of objects of duplicate templates
 */
const duplicateResources = async (resourceDetails, resourceCertificate, programData) => {
	try {
		// initialise list of project templates to create
		let projectTemplateIds = []
		//initialise list of solution templates to create
		let solutionTemplateIds = []
		let certificate = resourceCertificate
		if (certificate) {
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
			const projectsCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('TEMPLATES'))
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
				const projectsTaskCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('TASKS'))
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
					// if task is part of certificate criteria , replace the old task name with new task name
					// this is required as task name is used to identify the task in certificate criteria
					// as task id will be different for each project created from the template
					if (certificate) {
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
				})

				await projectsTaskCollection.insertMany(duplicateTasks)

				const projectsTasksDetailsAfterInsert = await projectsTaskCollection
					.find({
						externalId: {
							$in: duplicateTasks.map((tasks) => tasks.externalId),
						},
					})
					.toArray()

				// if certificate is there , replace the task details with object ids
				if (certificate) {
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

		const solutionCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('SOLUTIONS'))
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
		const projectTemplateCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('TEMPLATES'))

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
						`Failed to update the child project template with solution details into the ${COLLECTIONS_MAP.get(
							'TEMPLATES'
						)} collection.`
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

const orderSolutionsInProgram = (resourceWithInProgram) => {
	let solutionOrderList = resourceWithInProgram.map((item) => ({ id: item.id }))

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
		return acc
	}, {})
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
						parent_id: rolloutDetails.id,
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
			let solutionOrderMap = orderSolutionsInProgram(resourceWithInProgram)
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
				const fetchDetails = await rolloutService.details(
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
							})
							projectCertificate = fetchDetails?.result?.certificate
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
							projectCertificate = fetchProjectDetails?.result?.certificate
						}

						let duplicateResource = await duplicateResources(
							{
								...fetchDetails?.result,
								published_id: publishedProject?.templateId,
							},
							projectCertificate,
							programData
						)
						if (!duplicateResource.success) {
							console.log('Error in creating duplicate Resource')
							throw new Error(
								`Error in creating duplicate Resource ${duplicateResource?.error || 'Unknown Error'}`
							)
						}

						const targeting = await processTargetingCriteria(
							fetchDetails?.result?.targeting_criteria,
							fetchDetails?.result?.organization_code,
							fetchDetails?.result?.tenant_code
						)
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
				const solutionCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('SOLUTIONS'))

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
				await resourceService.publishCallback(programResourceTableId, programId ? programId.toString() : null)
			}
			// update rollout table with published Id
			await rolloutService.publishCallback(
				programData.id,
				programId ? programId.toString() : null,
				null,
				isProgramResource
			)
			solutions.forEach(async (solution) => {
				if (isProgramResource) {
					// update resource table with published Id
					await resourceService.publishCallback(
						solution.scp_reference_id,
						solution?._id ? solution?._id.toString() : null,
						solution?.link ? solution?.link : false
					)
				}
				// update rollout table with published Id
				await rolloutService.publishCallback(
					solution.rolloutId,
					solution?._id ? solution?._id.toString() : null,
					solution?.projectTemplateId ? solution?.projectTemplateId.toString() : null,
					isProgramResource
				)
			})

			//create user and program mapping
			const viewerIds = rolloutDetails.viewers.map((viewer) => viewer?.id || viewer)
			if (programId && viewerIds.length > 0) {
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
				},
				{
					status: common.ROLLOUT_STATUS_FAILED,
				}
			)

			return resolve(result)
		}
	})
}

/**
 * Maps users to a program using interfaceRequests.
 * @param {Array} viewers - Array of user IDs.
 * @param {String|ObjectId} programId - Program ID.
 * @param {String} tenantCode - Tenant code.
 * @param {String} orgCode - Organization code.
 * @param {String|null} userId - User ID performing the mapping.
 * @returns {Promise<Boolean>}
 */
async function createOrUpdateUserProgramMapping(viewers, programId, orgCode, tenantCode, userId = null) {
	return new Promise(async (resolve, reject) => {
		try {
			const roles = (process.env.DEFAULT_PROGRAM_MANAGERS || '')
				.split(',')
				.map((role) => role.trim())
				.filter(Boolean)
			if (roles.length === 0) {
				throw new Error('No roles defined in DEFAULT_PROGRAM_MANAGERS environment variable')
			}

			const userProgramCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('USER_EXTENSIONS'))
			// Fetch all userExtensions for viewers
			const userExtensions = await userProgramCollection.find({ userId: { $in: viewers } }).toArray()

			// Find all userExtensions mapped to this program
			const mappedUserExtensions = await userProgramCollection
				.find({
					'programRoleMapping.programId': programId,
				})
				.toArray()

			// Users already mapped to this program
			const alreadyMappedUserIds = mappedUserExtensions.map((userExt) => userExt.userId)

			// Users in viewers but not mapped to program (need append)
			const toAppend = viewers.filter((userId) => {
				const ext = userExtensions.find((userExt) => userExt.userId === userId)
				// If userExtension not present, need append
				if (!ext) return true
				// If userExtension present but programId not present, need append
				const hasProgram = ext.programRoleMapping?.some((prm) => String(prm.programId) === String(programId))
				return !hasProgram
			})

			// Users mapped to program but not in viewers (need remove)
			// For each user mapped to the program but not present in viewers, prepare a remove operation
			const toRemove = alreadyMappedUserIds.filter((userId) => !viewers.includes(userId))

			// Prepare data for API call
			const requestBody = []
			// Only append if userExtension not present or programId not present in userExtension
			programId = programId.toString()
			if (toAppend.length > 0) {
				for (const userId of toAppend) {
					requestBody.push({
						userId,
						programId,
						operation: common.OPERATION_APPEND,
						roles: roles,
					})
				}
			}

			// Only remove if userExtension and programId present in userEx
			// For each user mapped to the program but not present in viewers, prepare a remove operation
			if (toRemove.length > 0) {
				for (const userId of toRemove) {
					requestBody.push({
						userId,
						programId,
						operation: common.OPERATION_REMOVE,
						roles: roles,
					})
				}
			}

			if (requestBody.length === 0) {
				console.log('No user mapping changes required for program:', programId)
				return resolve(true)
			}
			// Call the consumption service to update mappings
			let userMappingResponse = await interfaceRequests.mapUserAndProgram(
				requestBody,
				orgCode,
				tenantCode,
				userId
			)

			if (userMappingResponse.status !== responseCode.ok) {
				console.error('Error updating user extensions:', userMappingResponse)
				throw new Error('Failed to update user extensions')
			}

			console.log('Successfully updated user extensions for program:', programId)
			return resolve(true)
		} catch (error) {
			console.error('Error in createOrUpdateUserProgramMapping:', error)
			return reject(error)
		}
	})
}

module.exports = {
	publishProjectTemplates,
	publishProgram,
}

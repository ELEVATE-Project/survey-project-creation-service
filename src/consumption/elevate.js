const { projectsMongoDBUrl, surveyMongoDBUrl } = require('@consumption/config')

const projectService = require('@services/projects')
const utils = require('@generics/utils')
const common = require('@constants/common')
const MongoDBConnection = require('@configs/mongoConnection')
const resourceService = require('@services/resource')
const rolloutService = require('@services/rollouts')
let projectsMongoConnection = null
let mongoConnection = null

// Define the mongoDb collection names used
const COLLECTIONS_MAP = new Map(
	Object.entries({
		CATEGORIES: 'projectCategories',
		TEMPLATES: 'projectTemplates',
		TASKS: 'projectTemplateTasks',
		USER_ROLES: 'userRoles',
		PROGRAMS: 'programs',
		SOLUTIONS: 'solutions',
		CERTIFICATE_TEMPLATE: 'certificateTemplates',
		CERTIFICATE_BASE_TEMPLATE: 'certificateBaseTemplates',
	})
)

/**
 * To connect with the mongoDB with the given url
 * @name connectMongo
 * @param {Object} url - mongo url as returned from config
 * @returns {Object} - Connection Object
 */
const connectMongo = async (url) => {
	mongoConnection = new MongoDBConnection(url)
	await mongoConnection.connect() // This returns the db, but it's not stored
	// Get the database instance
	return mongoConnection.getDb()
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
		const taskCollection = projectsMongoConnection.collection(COLLECTIONS_MAP.get('TASKS'))
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
 * Process targeting criteria
 * @name processTargetingCriteria
 * @param {Object} targetingData - Program template data
 * @returns {Object} - Response contains scope and metaInformation
 */
const processTargetingCriteria = async (targetingData) => {
	try {
		let scope = {
			roles: [],
			entityType: [],
		}

		let metaInformation = process.env.PROGRAM_META_INFO_KEYS.split(',').reduce((acc, key) => {
			acc[key] = []
			return acc
		}, {})

		if (targetingData) {
			// Iterate through each targeting criterion
			targetingData.forEach((targeting) => {
				const targetingEntity = targeting?.entity_targeting?.value

				scope.entityType.push(targetingEntity)

				if (targeting?.roles?.length) {
					// Add unique roles to scope and metaInformation
					targeting.roles.forEach(({ code, label }) => {
						scope.roles.push(code)
						if (metaInformation.hasOwnProperty('recommendedFor')) {
							metaInformation.recommendedFor.push(label)
						}
					})

					process.env.PROGRAM_META_INFO_KEYS.split(',').forEach((metaKey) => {
						if (targeting[metaKey]) {
							targeting[metaKey].forEach((eachKeys) => {
								metaInformation[metaKey].push(eachKeys.name)
							})
						}
					})

					targeting[targetingEntity]?.forEach(({ _id }) => {
						scope[targetingEntity] = scope[targetingEntity] || []
						scope[targetingEntity].push(_id)
					})
				} else {
					// Reset roles and recommendedFor if no roles are present
					scope.roles = []
					metaInformation.recommendedFor = []
				}
			})
		}

		// refactor scope to remove duplicates
		Object.keys(scope).forEach((key) => {
			if (Array.isArray(scope[key] && scope[key].length > 0)) {
				scope[key] = [...new Set(scope[key])] // Remove duplicates while preserving array structure
			}
		})

		if (!isSunbird) {
			// convert the 'entityType' array to coma separated string
			scope.entityType = scope?.entityType ? [...new Set(scope.entityType)] : []
			// refactor metaInformation to remove duplicates
			Object.keys(metaInformation).forEach((key) => {
				if (Array.isArray(metaInformation[key]) && metaInformation[key].length > 0) {
					metaInformation[key] = [...new Set(metaInformation[key])] // Remove duplicates while preserving array structure
				}
			})
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
			const targeting = await processTargetingCriteria(programData?.targeting_criteria)
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
				templateData.tenant_code,
				templateData.organization_code
			)

			projectData = projectData?.result || {}

			if (Object.keys(projectData).length <= 0) {
				throw new Error('FAILED_TO_FETCH_PROJECT')
			}
			// Format the template
			let formattedTemplate = formatTemplate(projectData)
			if (!formattedTemplate.success) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.template

			projectsMongoConnection = await connectMongo(projectsMongoDBUrl)

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
			const resource_type = programData.type
			const loggedInUserId = programData.userId
			const isProgramResource = resource_type === common.RESOURCE_TYPE_PROGRAM
			let resourceDetails = null
			if (isProgramResource) {
				// fetch program details
			} else {
				resourceDetails = await rolloutService.details(
					programData.id,
					loggedInUserId,
					programData.organization_code,
					programData.tenant_code,
					false,
					true
				)
				resourceDetails = resourceDetails?.result || {}
			}

			// Format the program template
			let formattedTemplate = await formatProgramTemplate(programData)

			if (!formattedTemplate.success) {
				throw new Error('FAILED_TO_FORMAT_TEMPLATE')
			}

			let template = formattedTemplate.programDocument

			let programResourceRolloutMap = {}

			if (isProgramResource) {
				// get the resource ids in a program
				const programResourceIds = programData?.resources.map((resource) => resource.id)
				if (programResourceIds.length > 0) {
					// find all the resource rollout data
					const rolloutData = await rolloutQueries.findAll(
						{
							resource_id: {
								[Op.in]: programResourceIds,
							},
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
			}

			let result = {}
			let solutions = []
			let programId = template?._id ? ObjectId(template?._id) : null

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

			const resourceWithInProgram = programData?.resources || [
				{
					id: programData.resource.rolloutId,
					targeting_criteria: programData.targeting_criteria,
				},
			]
			if (resourceWithInProgram.length === 0) {
				console.error('Consumption Error : Program Resources Empty.')
				throw new Error('NO_RESOURCE_ADDED')
			}
			let solutionIds = []
			let resourceToUpdate = []

			for (const resource of resourceWithInProgram) {
				// for programs check the map and get the rollout id from resource id
				// for single rollout use the rollout id directly
				const rolloutId = isProgramResource ? programResourceRolloutMap[resource.id] : resource.id
				if (!rolloutId)
					throw new Error(
						`Rollout For Resource ( ${resource?.id} ) ${
							isProgramResource ? 'within Program ' : 'within Single rollout '
						} is not created`
					)
				const fetchDetails = await rolloutService.details(
					rolloutId,
					programData.organization_code,
					programData.created_by,
					false
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
								programData?.resource?.resource_id,
								programData?.resource?.organization_code
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

						const targeting = await processTargetingCriteria(resource?.targeting_criteria)
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
							created_by: programData.created_by,
							orgId: programData.organization_code,
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
						if (!createSolutionsData.success)
							throw new Error(`Error : ${createSolutionsData?.error || 'Unknown Error'}`)
						solutions = [...solutions, ...createSolutionsData.data]
						solutionIds = [...new Set([...solutionIds, ...solutions.map((solution) => solution._id)])]
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
				const solutionCollection = mongoDb.collection(COLLECTIONS.SOLUTIONS)

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

			if (solutionIds.length > 0) {
				await updateProgram(programId, {
					components: Array.from(
						new Set(
							solutionIds.map((solution) =>
								solution instanceof ObjectId ? solution : ObjectId(solution)
							)
						)
					),
				})
			}
			if (isProgramResource) {
				// update resource table with published Id
				await resourceService.publishCallback(programData.resource_id, programId ? programId.toString() : null)
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
module.exports = {
	publishProjectTemplates,
	publishProgram,
}

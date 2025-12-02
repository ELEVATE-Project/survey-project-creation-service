/**
 * name : project.js
 * author : Priyanka Pradeep
 * Date : 18-NOV-2025
 * Description : DTO for project template data transformation
 */

'use strict'

const utils = require('@generics/utils')
const common = require('@constants/common')
const consumptionCommon = require('@consumption/constants/elevate/common')

/**
 * Assign sequence numbers to tasks
 * @method
 * @name assignSequenceNumbers
 * @param {Array} tasks - Array of task objects
 * @returns {Array} - Array of tasks with assigned sequence numbers
 * @description sorts by existing sequence_no, and reassigns sequential numbers
 */
exports.assignSequenceNumbers = (tasks) => {
	// Sort tasks based on their current sequence number (ascending order)
	tasks.sort((a, b) => a.sequence_no - b.sequence_no)
	let sequenceCounter = 1
	return tasks.map((task) => {
		task.sequence_no = sequenceCounter++ // Reassign sequence number
		return task
	})
	/* Temporary fix end */

	// Original implementation (commented out for future reference):
	// let sequenceCounter = 1
	// return tasks.map((task) => {
	// 	if (!task.sequence_no) {
	// 		task.sequence_no = sequenceCounter++
	// 	}
	// 	return task
	// })
}

/**
 * Format categories from project data
 * @method
 * @name formatCategories
 * @param {Array} categories - Array of category objects with label and value
 * @returns {Object} - Response with success status and formatted categories array
 */
exports.formatCategories = (categories) => {
	try {
		if (!categories || !Array.isArray(categories)) {
			throw new Error('Categories must be an array')
		}

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

		return { success: true, data: formattedCategories }
	} catch (error) {
		return { success: false, error: `Failed to format categories: ${error.message}` }
	}
}

/**
 * Create MongoDB category documents ready for insertion
 * @method
 * @name createCategoryDocuments
 * @param {Array} formattedCategories - Array of formatted categories from formatCategories
 * @param {String} orgCode - Organization code
 * @param {String} tenantCode - Tenant code
 * @returns {Array} - Array of complete MongoDB category documents
 */
exports.createCategoryDocuments = (formattedCategories, orgCode, tenantCode) => {
	return formattedCategories.map(({ formattedName, externalId, label }) => ({
		createdBy: consumptionCommon.CREATED_BY_SYSTEM,
		updatedBy: consumptionCommon.CREATED_BY_SYSTEM,
		isDeleted: false,
		isVisible: true,
		status: consumptionCommon.STATUS_ACTIVE,
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
}

/**
 * Format Recommended Roles from project data
 * @method
 * @name formatRecommendedRoles
 * @param {Array} recommendedFor - An array of objects containing label and value for recommended roles
 * @returns {Object} - Response with success status and recommended roles array
 */
exports.formatRecommendedRoles = (recommendedFor) => {
	try {
		const recommendedRoles = recommendedFor?.length
			? recommendedFor.filter((item) => item?.label).map((item) => item.label)
			: []

		return { success: true, data: recommendedRoles }
	} catch (error) {
		return { success: false, error: `Failed to process recommended for: ${error.message}` }
	}
}

/**
 * Format task data for MongoDB insertion
 * @method
 * @name formatTaskDocument
 * @param {Object} task - Task data from input
 * @param {String} templateId - Template ID
 * @param {String} templateExternalId - Template external ID
 * @param {String|null} parentId - Parent task ID
 * @param {String} organizationCode - Organization code
 * @param {String} tenantCode - Tenant code
 * @returns {Object} - Formatted task document
 */
exports.formatTaskDocument = (task, templateId, templateExternalId, parentId, organizationCode, tenantCode) => {
	return {
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
}

/**
 * Format Project Template DTO for Elevate consumption
 * @method
 * @name formatProjectTemplateDTO
 * @param {Object} templateData - Project template data from resource
 * @returns {Object} Response with formatted template or error
 */
exports.formatProjectTemplateDTO = (templateData) => {
	try {
		// Validate required fields
		if (!templateData || typeof templateData !== 'object') {
			throw new Error('Invalid template data provided')
		}

		const requiredFields = {
			title: 'Template title is required',
			tenant_code: 'Tenant code is required',
			organization_code: 'Organization code is required',
			user_id: 'User ID is required',
		}

		for (const [field, errorMsg] of Object.entries(requiredFields)) {
			if (!templateData[field]) {
				throw new Error(errorMsg)
			}
		}

		// Build the formatted template
		const template = {
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
			recommendedFor: [], // Initially empty, to be populated later
			categories: [], // Initially empty, to be populated later
			tasks: [], // Initially empty, to be populated after task creation
			taskSequence: [], // Initially empty, to be populated after task creation
			createdAt: new Date(),
			updatedAt: new Date(),
		}

		return {
			success: true,
			data: template,
		}
	} catch (error) {
		console.error('Error in formatProjectTemplateDTO:', error.message)
		return {
			success: false,
			error: error.message,
		}
	}
}

/**
 * name : project.js
 * author : Priyanka Pradeep
 * Date : 18-NOV-2025
 * Description : DTO for project template data transformation
 */

'use strict'

const utils = require('@generics/utils')
const common = require('@constants/common')

/**
 * Assign sequence numbers to tasks
 * @method
 * @name assignSequenceNumbers
 * @param {Array} tasks - Array of task objects
 * @returns {Array} - Array of tasks with assigned sequence numbers
 * @description Filters out 'observation' type tasks (temporary fix), sorts by existing sequence_no, and reassigns sequential numbers
 */
exports.assignSequenceNumbers = (tasks) => {
	/* Temporary fix start, because elevate-project doesn't have the observation capability in tasks now */
	// Filter out 'observation' type tasks
	const filteredTasks = tasks.filter((task) => task.type !== common.OBSERVATION)
	// Sort tasks based on their current sequence number (ascending order)
	filteredTasks.sort((a, b) => a.sequence_no - b.sequence_no)
	let sequenceCounter = 1
	return filteredTasks.map((task) => {
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

		if (!templateData.title) {
			throw new Error('Template title is required')
		}

		if (!templateData.tenant_code) {
			throw new Error('Tenant code is required')
		}

		if (!templateData.organization_code) {
			throw new Error('Organization code is required')
		}

		if (!templateData.user_id) {
			throw new Error('User ID is required')
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

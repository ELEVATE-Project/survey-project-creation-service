/**
 * name : program.js
 * author : Priyanka Pradeep
 * Date : 18-NOV-2025
 * Description : DTO for program data transformation
 */

'use strict'

const utils = require('@generics/utils')
const common = require('@constants/common')
const { ObjectId } = require('mongodb')
const targetingHelper = require('@consumption/helpers/elevate/targeting')

/**
 * Order solutions within a program based on explicit order or position
 * @method
 * @name orderSolutionsInProgram
 * @param {Array} resourceWithInProgram - Array of resources with optional order property
 * @returns {Object} - Mapping of resource IDs to their order and _id
 */
exports.orderSolutionsInProgram = (resourceWithInProgram) => {
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
 * Format Program Template DTO for Elevate consumption
 * @method
 * @name formatProgramTemplateDTO
 * @param {Object} programData - Program template data from resource
 * @param {Object} scopeKeys - Scope keys configuration (optional)
 * @returns {Object} Response with formatted program document or error
 */
exports.formatProgramTemplateDTO = async (programData, scopeKeys = {}) => {
	try {
		// Validate required fields
		if (!programData || typeof programData !== 'object') {
			throw new Error('Invalid program data provided')
		}

		if (!programData.organization_code) {
			throw new Error('Organization code is required')
		}

		if (!programData.tenant_code) {
			throw new Error('Tenant code is required')
		}

		let programDocument = {}

		// Process targeting criteria if provided
		if (programData?.targeting_criteria) {
			const targeting = await targetingHelper.processTargetingCriteria(
				programData?.targeting_criteria,
				programData.organization_code,
				programData.tenant_code,
				scopeKeys
			)

			if (!targeting?.success) {
				return {
					success: false,
					error: targeting?.error || 'Failed to process targeting criteria',
				}
			}

			programDocument.scope = targeting?.scope ? targeting?.scope : {}
			programDocument.metaInformation = targeting?.metaInformation ? targeting?.metaInformation : {}
		}

		// Set common date fields
		programDocument.updatedAt = new Date()
		programDocument.endDate = new Date(programData?.end_date)
		programDocument.startDate = new Date(programData?.start_date)

		// If the program is already published, update _id from the published_id
		if (programData?.published_id) {
			programDocument._id = ObjectId(programData.published_id)
		} else {
			// Extract languages from resources
			let language = programData?.language
				? programData?.resource.flatMap((resource) => {
						return resource.languages.map((language) => {
							return language.label
						})
				  })
				: []

			language = [...new Set(language)]

			// Extract or format keywords
			let keywords = programData?.keywords
				? programData?.keywords
				: programData?.resource
				? utils.formatKeywords(programData?.resource?.keywords)
				: []
			keywords = [...new Set(keywords)]

			// Build the complete program document
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

		return {
			success: true,
			data: programDocument,
		}
	} catch (error) {
		console.error('Error in formatProgramTemplateDTO:', error.message)
		return {
			success: false,
			error: error.message,
		}
	}
}

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
const { formatProgramTemplateDTO } = require('@consumption/dtos/shared/programFormatter')
exports.formatProgramTemplateDTO = formatProgramTemplateDTO

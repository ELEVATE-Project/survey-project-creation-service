'use strict'
const { ResourceCreatorMapping, Resource, Review } = require('../models/index')

exports.create = async (data) => {
	try {
		return await ResourceCreatorMapping.create(data, { returning: true })
	} catch (error) {
		return error
	}
}
exports.findAll = async (filter, attributes = {}, options = {}) => {
	try {
		// Define valid fields for ordering to prevent invalid column names
		const validOrderFields = ['id', 'createdAt', 'updatedAt' /* Add other valid columns */]
		const validOrderDirections = ['ASC', 'DESC']

		// Initialize query options
		let queryOptions = {
			where: filter,
			attributes,
			raw: true,
			...options,
		}

		// Handle include for Resource association
		if (
			(options.resourceAttributes && options.resourceAttributes.length > 0) ||
			(options.resourceFilter && Object.keys(options.resourceFilter).length > 0) ||
			(options.resourceOptions && Object.keys(options.resourceOptions).length > 0)
		) {
			queryOptions = {
				...queryOptions,
				...options.resourceOptions,
			}
			delete queryOptions.resourceOptions

			queryOptions.include = [
				{
					model: Resource,
					as: 'resource',
					attributes:
						options.resourceAttributes && options.resourceAttributes.length > 0
							? options.resourceAttributes
							: null,
					where: { tenant_code: filter.tenant_code, ...options.resourceFilter },
				},
			]
			queryOptions.raw = false
			delete queryOptions.resourceAttributes
			delete queryOptions.resourceFilter
		}

		// Handle order option
		const order = []
		if (options.orderBy?.field && validOrderFields.includes(options.orderBy.field)) {
			// Check if sorting by a column in the Resource model
			if (options.orderBy.field.startsWith('resource.')) {
				const field = options.orderBy.field.replace('resource.', '')
				if (validOrderFields.includes(field)) {
					// Ensure field is valid for Resource
					order.push([{ model: Resource, as: 'resource' }, field, options.orderBy.direction || 'ASC'])
				}
			} else {
				order.push([
					options.orderBy.field,
					options.orderBy.direction && validOrderDirections.includes(options.orderBy.direction)
						? options.orderBy.direction
						: 'ASC',
				])
			}
		}
		queryOptions.order = order // Always set order as an array

		// Handle limit and offset
		if (options.limit) {
			queryOptions.limit = parseInt(options.limit, 10)
		}
		if (options.offset) {
			queryOptions.offset = parseInt(options.offset, 10)
		}

		// Execute query
		const res = await ResourceCreatorMapping.findAll(queryOptions)

		// Handle the result based on raw value
		if (queryOptions.raw) return res // Already plain objects, no need for toJSON
		return Array.isArray(res) ? res.map((item) => (item.toJSON ? item.toJSON() : item)) : res
	} catch (error) {
		throw error // Re-throw the error for proper handling upstream
	}
}

// Helper function to initialize query options
const initializeQueryOptions = (filter, attributes, options) => {
	let queryOptions = {
		where: filter,
		attributes,
		raw: false,
		nest: false,
		...options,
	}
	return queryOptions
}

// Helper function to handle resource include logic
const handleResourceInclude = (queryOptions, filter, options) => {
	if (
		(options.resourceAttributes && options.resourceAttributes.length > 0) ||
		(options.resourceFilter && Object.keys(options.resourceFilter).length > 0) ||
		(options.resourceOptions && Object.keys(options.resourceOptions).length > 0)
	) {
		if (!Object.keys(queryOptions).includes('include')) queryOptions.include = []
		queryOptions = {
			...queryOptions,
			...options.resourceOptions,
		}
		delete queryOptions.resourceOptions

		let resourceInclude = {
			model: Resource,
			as: 'resource',
			required: true,
			attributes:
				options.resourceAttributes && options.resourceAttributes.length > 0 ? options.resourceAttributes : null,
			where: { tenant_code: filter.tenant_code, ...options.resourceFilter },
		}

		if (
			(options.reviewsAttributes && options.reviewsAttributes.length > 0) ||
			(options.reviewsFilter && Object.keys(options.reviewsFilter).length > 0) ||
			(options.reviewsOptions && Object.keys(options.reviewsOptions).length > 0)
		) {
			resourceInclude.include = {
				model: Review,
				as: 'reviews',
				required: false,
				attributes:
					options.reviewsAttributes && options.reviewsAttributes.length > 0
						? options.reviewsAttributes
						: null,
				where: { tenant_code: filter.tenant_code, ...options.reviewsFilter },
			}
		}

		queryOptions.include.push(resourceInclude)
		queryOptions.raw = true
		queryOptions.nest = true
		delete queryOptions.resourceAttributes
		delete queryOptions.resourceFilter
	}

	return queryOptions
}

// Helper function to handle order options
const handleOrderOptions = (options) => {
	const validOrderFields = ['id', 'createdAt', 'updatedAt' /* Add other valid columns */]
	const validOrderDirections = ['ASC', 'DESC']
	const order = []

	if (options.orderBy?.field && validOrderFields.includes(options.orderBy.field)) {
		if (options.orderBy.field.startsWith('resource.')) {
			const field = options.orderBy.field.replace('resource.', '')
			if (validOrderFields.includes(field)) {
				order.push([{ model: Resource, as: 'resource' }, field, options.orderBy.direction || 'ASC'])
			}
		} else {
			order.push([
				options.orderBy.field,
				options.orderBy.direction && validOrderDirections.includes(options.orderBy.direction)
					? options.orderBy.direction
					: 'ASC',
			])
		}
	}

	return order
}

// Helper function to handle pagination options
const handlePaginationOptions = (queryOptions, options) => {
	if (options.limit) {
		queryOptions.limit = parseInt(options.limit, 10)
	}
	if (options.offset) {
		queryOptions.offset = parseInt(options.offset, 10)
	}
	return queryOptions
}

// Main function
exports.findAndCountAll = async (filter, attributes = {}, options = {}) => {
	try {
		let queryOptions = initializeQueryOptions(filter, attributes, options)
		queryOptions = handleResourceInclude(queryOptions, filter, options)
		queryOptions.order = handleOrderOptions(options)
		queryOptions = handlePaginationOptions(queryOptions, options)

		const res = await ResourceCreatorMapping.findAndCountAll(queryOptions)
		return res
	} catch (error) {
		throw error
	}
}

exports.findOne = async (filter, attributes = {}, options = {}) => {
	try {
		let raw = true
		if (options.resourceAttributes && options.resourceAttributes.length > 0) {
			options.include = [
				{
					model: Resource,
					attributes: options.resourceAttributes,
					as: 'resource',
					where: { tenant_code: filter.tenant_code },
					required: true,
				},
			]
			raw = false
		}

		const res = await ResourceCreatorMapping.findOne({
			where: filter,
			attributes,
			raw,
			...options,
		})
		if (!raw) return res.toJSON()
		return res
	} catch (error) {
		return error
	}
}

exports.updateOne = async (filter, update, options = {}) => {
	try {
		const [res] = await ResourceCreatorMapping.update(
			update,
			{
				where: filter,
				...options,
				individualHooks: true,
			},
			{ returning: true }
		)

		return res
	} catch (error) {
		return error
	}
}

exports.deleteOne = async (id, creator_id, orgCode, tenantCode) => {
	try {
		return await ResourceCreatorMapping.destroy({
			where: {
				id,
				creator_id,
				organization_code: orgCode,
				tenant_code: tenantCode,
			},
			individualHooks: true,
		})
	} catch (error) {
		throw error
	}
}

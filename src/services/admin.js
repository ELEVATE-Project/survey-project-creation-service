/**
 * name : admin.js
 * author : Priyanka Pradeep
 * created-date : 08-Sep-2025
 * Description : Admin service helper
 */

const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const { sequelize } = require('@database/models')
const { queryForbiddenPatterns } = require('@constants/blacklistConfig')

// Global regex cache for performance (moved outside function)
const regexCache = new Map()

module.exports = class AdminService {
	/**
	 * Execute a raw SELECT SQL query passed by the user.
	 * ⚠️ Only SELECT queries are allowed.
	 * @param {Object} data - The input object.
	 * @param {string} data.query - The raw SQL SELECT query string to execute.
	 * @param {number} pageNo - Page number for pagination.
	 * @param {number} pageSize - Page size for pagination.
	 * @returns {Promise<Object>} - Success response with query result.
	 * @throws {Error} - If the query is invalid, non-SELECT, or execution fails.
	 */
	static async dbFind(data, pageNo, pageSize) {
		try {
			// Validate input
			const query = validateQueryInput(data)

			// Security validation
			validateQuerySecurity(query)

			// Get pagination parameters
			const { limit, offset } = getPaginationParams(pageNo, pageSize)

			// Execute query
			const results = await executeQuery(query, limit, offset)

			// Return success response
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'DATA_FETCHED',
				result: { data: results },
			})
		} catch (error) {
			console.error('Query execution error:', error)
			return responses.failureResponse({
				statusCode: httpStatusCode.bad_request,
				message: error.message || 'Invalid query',
			})
		}
	}
}

/**
 * Validates basic query input requirements
 */
function validateQueryInput(data) {
	const rawQuery = data.query?.trim()

	if (!rawQuery || typeof rawQuery !== 'string') {
		throw new Error('Query must be a valid string')
	}

	if (!rawQuery.toLowerCase().startsWith('select')) {
		throw new Error('Only SELECT queries are allowed')
	}

	return rawQuery
}

/**
 * Comprehensive security validation for SQL queries
 */
function validateQuerySecurity(query) {
	if (!hasValidQuotes(query)) {
		throw new Error('QUERY_INVALID_OR_UNBALANCED_QUOTES')
	}

	if (hasCriticalInjectionPatterns(query)) {
		throw new Error('QUERY_FORBIDDEN_INJECTION_PATTERNS')
	}

	const normalizedQuery = normalizeQuery(query)

	if (hasForbiddenPatterns(normalizedQuery, query)) {
		throw new Error('QUERY_FORBIDDEN_PATTERNS')
	}
}

/**
 * Calculates pagination parameters with validation
 */
function getPaginationParams(pageNo, pageSize) {
	const validPageNo = Math.max(1, parseInt(pageNo) || 1)
	const validPageSize = Math.min(Math.max(1, parseInt(pageSize) || 100), 1000)
	const offset = (validPageNo - 1) * validPageSize

	return { limit: validPageSize, offset }
}

/**
 * Executes a validated SQL query with pagination
 */
async function executeQuery(query, limit, offset) {
	const paginatedQuery = `${query} LIMIT $1 OFFSET $2`

	return await sequelize.query(paginatedQuery, {
		bind: [limit, offset],
		type: sequelize.QueryTypes.SELECT,
		timeout: 30000,
	})
}

/**
 * Checks for critical injection patterns that immediately disqualify a query
 */
function hasCriticalInjectionPatterns(query) {
	const lowerQuery = query.toLowerCase()
	const criticalPatterns = ['--', ';', '/*', '*/', '#', '\\']

	return criticalPatterns.some((pattern) => lowerQuery.includes(pattern))
}

/**
 * Removes comments and string literals to get clean SQL for pattern analysis
 */
function normalizeQuery(query) {
	return query
		.toLowerCase()
		.replace(/\/\*[\s\S]*?\*\//g, ' ') // Remove /* */ comments
		.replace(/--.*$/gm, ' ') // Remove -- comments
		.replace(/#[^\n]*/g, ' ') // Remove # comments
		.replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, ' ') // Remove dollar quotes
		.replace(/'(?:''|[^'])*'/g, ' ') // Remove single-quoted strings
		.replace(/"(?:\\"|[^"])*"/g, ' ') // Remove double-quoted strings
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
}

/**
 * Checks if the normalized query contains any forbidden operations
 */
function hasForbiddenPatterns(normalizedQuery, originalQuery) {
	// Filter out quote patterns from forbidden patterns - they're handled separately
	const filteredPatterns = queryForbiddenPatterns.filter((pattern) => pattern !== "'" && pattern !== '"')

	// Use original query for certain patterns that might be affected by normalization
	const useOriginalFor = ['||', 'char(', 'chr(', 'concat(']

	return filteredPatterns.some((pattern) => {
		const regex = getCompiledRegex(pattern)
		const testQuery = useOriginalFor.includes(pattern) ? originalQuery.toLowerCase() : normalizedQuery
		return regex.test(testQuery)
	})
}

/**
 * Gets or creates a compiled regex pattern (cached for performance)
 */
function getCompiledRegex(pattern) {
	if (regexCache.has(pattern)) {
		return regexCache.get(pattern)
	}

	const cleanPattern = pattern.toLowerCase().trim()
	let regex

	if (/^[a-z\s]+$/.test(cleanPattern)) {
		// Word-based patterns: use word boundaries and handle spaces
		const escaped = cleanPattern
			.split(/\s+/)
			.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('\\s+')
		regex = new RegExp(`\\b${escaped}\\b`, 'i')
	} else {
		// Literal patterns: escape special characters
		const escaped = cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		regex = new RegExp(escaped, 'i')
	}

	regexCache.set(pattern, regex)
	return regex
}

/**
 * Validates that all quotes in the query are properly balanced and closed
 */
function hasValidQuotes(query) {
	let inSingleQuote = false
	let inDoubleQuote = false

	for (let i = 0; i < query.length; i++) {
		const char = query[i]
		const nextChar = query[i + 1]

		if (!inDoubleQuote && char === "'") {
			if (inSingleQuote) {
				// Check for escaped single quote ('')
				if (nextChar === "'") {
					i++ // Skip the escaped quote
					continue
				}
				inSingleQuote = false
			} else {
				inSingleQuote = true
			}
		} else if (!inSingleQuote && char === '"') {
			if (inDoubleQuote) {
				// Check for escaped double quote ("")
				if (nextChar === '"') {
					i++ // Skip the escaped quote
					continue
				}
				inDoubleQuote = false
			} else {
				inDoubleQuote = true
			}
		}
	}

	// All strings must be properly closed
	return !inSingleQuote && !inDoubleQuote
}

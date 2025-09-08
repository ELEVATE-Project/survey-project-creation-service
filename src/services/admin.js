/**
 * name : admin.js
 * author : Priyanka Pradeep
 * created-date : 08-Sep-2025
 * Description : Admin service helper
 */

const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
const common = require('@constants/common')
const { sequelize } = require('@database/models')
const { queryForbiddenPatterns } = require('@constants/blacklistConfig')

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
			const rawQuery = data.query?.trim()
			if (!rawQuery) {
				throw new Error('Query must be a valid string')
			}

			if (!this.isQuerySafe(rawQuery)) {
				throw new Error('Query is not allowed or references restricted operations/tables')
			}

			const { limit, offset } = this.getPagination(pageNo, pageSize)

			const queryData = await sequelize.query(rawQuery, {
				replacements: { limit, offset },
				type: sequelize.QueryTypes.SELECT,
				timeout: 30000,
			})

			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'DATA_FETCHED',
				result: {
					data: queryData,
				},
			})
		} catch (error) {
			console.error('Query execution error:', error)
			return responses.failureResponse({
				statusCode: httpStatusCode.bad_request,
				message: error.message || 'Invalid query',
			})
		}
	}

	/**
	 * Check if query is safe using forbidden patterns.
	 * Normalizes the query before checking.
	 * @param {string} query - The raw SQL query.
	 * @returns {boolean} - True if the query is safe, false otherwise.
	 */
	static isQuerySafe(query) {
		const lowerQuery = query.toLowerCase()

		// Quick reject for tokens that must not appear
		const immediateForbidden = ['--', ';', '/*', '*/', '#', '\\', "'", '"']
		if (immediateForbidden.some((tok) => lowerQuery.includes(tok))) {
			return false
		}

		// Normalize: strip comments and literals, collapse whitespace
		const normalizedQuery = lowerQuery
			.replace(/\/\*[\s\S]*?\*\//g, ' ')
			.replace(/--.*$/gm, ' ')
			.replace(/#[^\n]*/g, ' ')
			.replace(/\$[A-Za-z0-9_]*\$[\s\S]*?\$[A-Za-z0-9_]*\$/g, ' ')
			.replace(/'(?:''|[^'])*'/g, ' ')
			.replace(/"(?:\\"|[^"])*"/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()

		// Match forbidden patterns robustly
		return !queryForbiddenPatterns.some((pattern) => {
			const pat = String(pattern).toLowerCase().trim()
			const regex = /^[a-z\s]+$/.test(pat)
				? new RegExp(`\\b${pat.replace(/\s+/g, '\\s+')}\\b`, 'i')
				: new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
			return regex.test(normalizedQuery)
		})
	}

	/**
	 * Get pagination parameters.
	 * @param {number} pageNo - Page number.
	 * @param {number} pageSize - Page size.
	 * @returns {{limit: number, offset: number}} - Pagination parameters.
	 */
	static getPagination(pageNo, pageSize) {
		const validPageNo = Math.max(1, parseInt(pageNo) || 1)
		const validPageSize = Math.min(Math.max(1, parseInt(pageSize) || 100), 1000)
		const offset = common.getPaginationOffset(validPageNo, validPageSize)
		return { limit: validPageSize, offset }
	}
}

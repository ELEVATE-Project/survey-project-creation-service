/**
 * name : entity.js
 * author : Aman Gupta
 * created-date : 04-Nov-2021
 * Description : Entity Controller.
 */

// Dependencies
const entityService = require('@services/entities')
const utils = require('@generics/utils')
const common = require('@constants/common')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')
module.exports = class Entity {
	/**
	 * create entity
	 * @method
	 * @name create
	 * @param {Object} req - request data.
	 * @returns {JSON} - entities creation object.
	 */

	async create(req) {
		try {
			const { tenantCode, orgCode, error } = utils._extractTenantAndOrgCodes(req)
			if (error)
				return responses.failureResponse({
					message: error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const createdEntity = await entityService.create(req.body, req.decodedToken.id, orgCode, tenantCode)
			return createdEntity
		} catch (error) {
			return error
		}
	}

	/**
	 * updates entity
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - entities updation response.
	 */

	async update(req) {
		const params = req.body
		const id = req.params.id

		const { tenantCode, orgCode, error } = utils._extractTenantAndOrgCodes(req)
		if (error)
			return responses.failureResponse({
				message: error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		try {
			const updatedEntity = await entityService.update(params, id, req.decodedToken.id, orgCode, tenantCode)
			return updatedEntity
		} catch (error) {
			return error
		}
	}

	/**
	 * reads entities
	 * @method
	 * @name read
	 * @param {Object} req - request data.
	 * @returns {JSON} - entities.
	 */

	async read(req) {
		try {
			const { tenantCode, orgCode, error } = utils._extractTenantAndOrgCodes(req)
			if (error)
				return responses.failureResponse({
					message: error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			if (req.query.id || req.query.value) {
				return await entityService.read(req.query, req.decodedToken.id, orgCode, tenantCode)
			}
			return await entityService.readAll(req.query, req.decodedToken.id, orgCode, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * deletes entity
	 * @method
	 * @name delete
	 * @param {Object} req - request data.
	 * @returns {JSON} - entities deletion response.
	 */

	async delete(req) {
		try {
			const { tenantCode, orgCode, error } = utils._extractTenantAndOrgCodes(req)
			if (error)
				return responses.failureResponse({
					message: error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const updatedEntity = await entityService.delete(req.params.id, req.decodedToken.id, orgCode, tenantCode)
			return updatedEntity
		} catch (error) {
			return error
		}
	}

	/**
	 * entity list
	 * @method
	 * @name list
	 * @param {Object} req - request data.
	 * @returns {JSON} - entities.
	 */

	async list(req) {
		try {
			const { tenantCode, orgCode, error } = utils._extractTenantAndOrgCodes(req)
			if (error)
				return responses.failureResponse({
					message: error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			return await entityService.list(req.query, orgCode, tenantCode, req.searchText, req.pageNo, req.pageSize)
		} catch (error) {
			return error
		}
	}
}

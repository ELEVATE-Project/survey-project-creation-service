// Dependencies
const entityTypeService = require('@services/entity-types')
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
			let tenantCode = req.decodedToken.tenant_code
			let orgCode = req.decodedToken.organization_code
			if (utils.validateRoleAccess(req.decodedToken.roles, common.ADMIN_ROLE)) {
				const validHeader = utils.validateTenantAndOrganizationInHeader(req)
				if (!validHeader) {
					return responses.failureResponse({
						message: 'TENANT_ORGANIZATION_HEADER_MISSING',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				if (req.headers.tenant && req.headers.organization) {
					tenantCode = req.headers.tenant
					orgCode = req.headers.organization
				}
			}
			return await entityTypeService.create(req.body, req.decodedToken.id, orgCode, tenantCode)
		} catch (error) {
			return error
		}
	}

	/**
	 * updates entity
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - entities updating response.
	 */

	async update(req) {
		try {
			let tenantCode = req.decodedToken.tenant_code
			let orgCode = req.decodedToken.organization_code
			if (utils.validateRoleAccess(req.decodedToken.roles, common.ADMIN_ROLE)) {
				const validHeader = utils.validateTenantAndOrganizationInHeader(req)
				if (!validHeader) {
					return responses.failureResponse({
						message: 'TENANT_ORGANIZATION_HEADER_MISSING',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				if (req.headers.tenant && req.headers.organization) {
					tenantCode = req.headers.tenant
					orgCode = req.headers.organization
				}
			}
			return await entityTypeService.update(req.params.id, req.body, req.decodedToken.id, tenantCode, orgCode)
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
			let tenantCode = req.decodedToken.tenant_code
			let orgCode = req.decodedToken.organization_code
			if (utils.validateRoleAccess(req.decodedToken.roles, common.ADMIN_ROLE)) {
				const validHeader = utils.validateTenantAndOrganizationInHeader(req)
				if (!validHeader) {
					return responses.failureResponse({
						message: 'TENANT_ORGANIZATION_HEADER_MISSING',
						statusCode: httpStatusCode.bad_request,
						responseCode: 'CLIENT_ERROR',
					})
				}

				if (req.headers.tenant && req.headers.organization) {
					tenantCode = req.headers.tenant
					orgCode = req.headers.organization
				}
			}
			if (req.body.value) {
				return await entityTypeService.readUserEntityTypes(req.body, req.decodedToken.id, orgCode, tenantCode)
			}
			return await entityTypeService.readAllSystemEntityTypes(orgCode, tenantCode)
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
			return await entityTypeService.delete(req.params.id, req.decodedToken.organization_code)
		} catch (error) {
			return error
		}
	}
}

const httpStatusCode = require('@generics/http-status')
const formQueries = require('@database/queries/form')
const utils = require('@generics/utils')
const KafkaProducer = require('@generics/kafka-communication')
const form = require('@generics/form')
const responses = require('@helpers/responses')
const { UniqueConstraintError } = require('sequelize')
const Op = require('sequelize').Op
module.exports = class FormsHelper {
	/**
	 * Create Form.
	 * @method
	 * @name create
	 * @param {Object} bodyData
	 * @returns {JSON} - Form creation data.
	 */

	static async create(bodyData, orgCode, tenantCode) {
		try {
			const form = await formQueries.findOne({
				type: bodyData.type,
				organization_code: orgCode,
				tenant_code: tenantCode,
			})
			if (form) {
				throw new Error('FORM_ALREADY_EXISTS')
			}
			bodyData['organization_code'] = orgCode
			bodyData['tenant_code'] = tenantCode
			await formQueries.create(bodyData)
			await utils.internalDel('formVersion')
			await KafkaProducer.clearInternalCache('formVersion')
			return responses.successResponse({
				statusCode: httpStatusCode.created,
				message: 'FORM_CREATED_SUCCESSFULLY',
			})
		} catch (error) {
			if (error instanceof UniqueConstraintError) {
				return responses.failureResponse({
					message: 'FORM_ALREADY_EXISTS',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.failureResponse({
				message: error.message || error,
				statusCode: httpStatusCode.bad_request,
				responseCode: 'CLIENT_ERROR',
			})
		}
	}

	/**
	 * Update Form.
	 * @method
	 * @name update
	 * @param {Object} bodyData
	 * @returns {JSON} - Update form data.
	 */

	static async update(id, bodyData, orgCode, tenantCode) {
		try {
			let filter = {}
			bodyData['organization_code'] = orgCode
			bodyData['tenant_code'] = tenantCode

			if (id) {
				filter = { id: id, organization_code: orgCode, tenant_code: tenantCode }
			} else {
				filter = {
					type: bodyData.type,
					sub_type: bodyData.sub_type,
					organization_code: orgCode,
					tenant_code: tenantCode,
				}
			}

			const result = await formQueries.updateOneForm(filter, bodyData)
			if (result == 0) {
				return responses.failureResponse({
					message: 'FORM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			await utils.internalDel('formVersion')
			await KafkaProducer.clearInternalCache('formVersion')
			return responses.successResponse({
				statusCode: httpStatusCode.accepted,
				message: 'FORM_UPDATED_SUCCESSFULLY',
			})
		} catch (error) {
			throw error
		}
	}

	/**
	 * Read Form.
	 * @method
	 * @name read
	 * @param {Object} bodyData
	 * @returns {JSON} - Read form data.
	 */

	static async read(id, bodyData, orgCode, tenantCode) {
		try {
			const defaultOrgId = utils.convertToString(process.env.DEFAULT_ORGANIZATION_CODE)
			let filter = id ? { id } : { ...bodyData }
			filter = {
				...filter,
				organization_code: { [Op.in]: [defaultOrgId, orgCode] },
				tenant_code: tenantCode,
			}

			const form = await formQueries.findAll(filter)
			if (!form) {
				return responses.failureResponse({
					message: 'FORM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			let finalForm =
				form.find((f) => f.organization_code === orgCode) ||
				form.find((f) => f.organization_code === defaultOrgId)
			if (!finalForm) {
				return responses.failureResponse({
					message: 'FORM_NOT_FOUND',
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			}

			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'FORM_FETCHED_SUCCESSFULLY',
				result: finalForm,
			})
		} catch (error) {
			console.log(error)
			throw error
		}
	}
	static async readAllFormsVersion(orgCode, tenantCode) {
		try {
			return responses.successResponse({
				statusCode: httpStatusCode.ok,
				message: 'FORM_VERSION_FETCHED_SUCCESSFULLY',
				result: (await form.getAllFormsVersion(orgCode, tenantCode)) || {},
			})
		} catch (error) {
			return error
		}
	}
}

/**
 * name : form.js
 * author : Priyanka Pradeep
 * created-date : 21-May-2024
 * Description : Form Controller.
 */

// Dependencies
const formsService = require('@services/form')
const utils = require('@generics/utils')
const responses = require('@helpers/responses')
const httpStatusCode = require('@generics/http-status')

module.exports = class Form {
	/**
	 * create form data
	 * @method
	 * @name create
	 * @param {Object} req -request data.
	 * @param {string} req.body.type - form type.
	 * @param {string} req.body.subType -subtype of the form.
	 * @param {string} req.body.action -form action.
	 * @param {string} req.body.data -form data.
	 * @param {string} req.body.data.templateName -name of the template
	 * @returns {JSON} - returns the form data
	 */

	async create(req) {
		try {
			const { orgCode, tenantCode, error } = utils._extractTenantAndOrgCodes(req)
			if (error)
				return responses.failureResponse({
					message: error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const createdForm = await formsService.create(req.body, orgCode, tenantCode)
			return createdForm
		} catch (error) {
			return error
		}
	}

	/**
	 * update form data
	 * @method
	 * @name update
	 * @param {Object} req -request data.
	 * @param {string} req.body.type - form type.
	 * @param {string} req.body.subType -subtype of the form.
	 * @param {string} req.body.action -form action.
	 * @param {string} req.body.data -form data.
	 * @param {string} req.body.data.templateName -name of the template
	 * @returns {JSON} - returns the form data
	 */

	async update(req) {
		try {
			const { orgCode, tenantCode, error } = utils._extractTenantAndOrgCodes(req)
			if (error)
				return responses.failureResponse({
					message: error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			const updatedForm = await formsService.update(req.params.id, req.body, orgCode, tenantCode)
			return updatedForm
		} catch (error) {
			return error
		}
	}

	/**
	 * read form
	 * @method
	 * @name read
	 * @param {Object} req -request data.
	 * @param {string} req.body.type - form type.
	 * @param {string} req.body.subType -subtype of the form.
	 * @param {string} req.body.action -form action.
	 * @param {string} req.body.data -form data.
	 * @param {string} req.body.data.templateName -name of the template
	 * @returns {JSON} - returns the form data
	 */

	async read(req) {
		try {
			const { orgCode, tenantCode, error } = utils._extractTenantAndOrgCodes(req)
			if (error)
				return responses.failureResponse({
					message: error,
					statusCode: httpStatusCode.bad_request,
					responseCode: 'CLIENT_ERROR',
				})
			if (!req.params.id && Object.keys(req.body).length === 0) {
				const form = await formsService.readAllFormsVersion(orgCode, tenantCode)
				return form
			} else {
				const form = await formsService.read(req.params.id, req.body, orgCode, tenantCode)
				return form
			}
		} catch (error) {
			return error
		}
	}
}

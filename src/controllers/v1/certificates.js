/**
 * name : certificate.js
 * author : Priyanka Pradeep
 * created-date : 28-May-2024
 * Description : Controller for certificate details.
 */

const certificateService = require('@services/certificate')
module.exports = class certificates {
	/**
	 * List certificates.
	 * @method
	 * @name list
	 * @returns {JSON} - List of configs as response.
	 */
	async list(req) {
		try {
			const certificates = await certificateService.list(
				req.query.resource_type ? req.query.resource_type : '',
				req.decodedToken.organization_id,
				req.searchText
			)

			return certificates
		} catch (error) {
			return error
		}
	}

	/**
	 * create or update certificates.
	 * @method
	 * @name update
	 * @returns {JSON} - certificate data as response.
	 */
	async update(req) {
		try {
			const certificate = await certificateService.update(
				req.params.id ? req.params.id : '',
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id
			)

			return certificate
		} catch (error) {
			return error
		}
	}
}

/**
 * name : programs.js
 * author : Priyanka Pradeep
 * created-date : 23-Jan-2025
 * Description : Programs Controller.
 */

// Dependencies
const common = require('@constants/common')
const programService = require('@services/programs')
module.exports = class Programs {
	/**
	 * create or update program
	 * @method
	 * @name update
	 * @param {Object} req - request data.
	 * @returns {JSON} - program details
	 */

	async update(req) {
		try {
			if (req.params.id) {
				let program = {}
				if (req.method === common.REQUEST_METHOD_DELETE) {
					program = await programService.delete(req.params.id, req.decodedToken.id)
				} else {
					program = await programService.update(
						req.params.id,
						req.body,
						req.decodedToken.id,
						req.decodedToken.organization_id
					)
				}
				return program
			} else {
				const program = await programService.create(
					req.body,
					req.decodedToken.id,
					req.decodedToken.organization_id
				)
				return program
			}
		} catch (error) {
			return error
		}
	}
}

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

	/* Details Program.
	 * @method
	 * @name details
	 * @param {Object} req  user request.
	 * @returns {JSON} - Detail of program as response.
	 */
	async details(req) {
		try {
			const rollout = await programService.details(req.params.id, req.decodedToken.organization_id)
			return rollout
		} catch (error) {
			return error
		}
	}

	/* add Resources to program.
	 * @method
	 * @name addResources
	 * @param {Object} req  user request.
	 * @returns {JSON} - success / error response.
	 */
	async addResources(req) {
		try {
			return await programService.addResources(
				parseInt(req.params.id),
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id
			)
		} catch (error) {
			return error
		}
	}

	/* remove Resources from program.
	 * @method
	 * @name removeResources
	 * @param {Object} req  user request.
	 * @returns {JSON} - success / error response.
	 */
	async removeResources(req) {
		try {
			return await programService.removeResources(
				parseInt(req.params.id),
				req.body,
				req.decodedToken.id,
				req.decodedToken.organization_id
			)
		} catch (error) {
			return error
		}
	}

	/**
	 * getProgramManagers list.
	 * @method
	 * @name getProgramManagers
	 * @param {String} orgId - organization id
	 * @returns {JSON} - get the list of program managers
	 */

	async getProgramManagers(req) {
		try {
			const dataManagers = await programService.getProgramManagers(
				req.decodedToken.organization_id,
				req.pageNo,
				req.pageSize
			)
			return dataManagers
		} catch (error) {
			return error
		}
	}
}

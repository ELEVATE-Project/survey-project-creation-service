const formQueries = require('../database/queries/form')
async function getAllFormsVersion(orgCode, tenantCode) {
	try {
		return await formQueries.findAllTypeFormVersion(orgCode, tenantCode)
	} catch (error) {
		console.error(error)
	}
}
module.exports = { getAllFormsVersion }

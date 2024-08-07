'use strict'
const userRequests = require('@requests/user')
const utils = require('@generics/utils')
exports.getDefaultOrgId = async () => {
	try {
		let defaultOrgDetails = await userRequests.fetchOrg(process.env.DEFAULT_ORGANISATION_CODE)
		if (defaultOrgDetails.success && defaultOrgDetails.data && defaultOrgDetails.data.result)
			return utils.convertToString(defaultOrgDetails.data.result.id)
		else return null
	} catch (err) {
		console.log(err)
	}
}

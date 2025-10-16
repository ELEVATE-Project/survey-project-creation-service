/**
 * name : consumption/index.js
 * author : Adithya Dinesh
 * Date : 03-SEP-2025
 * Description : Decides the consumption service to be used.
 */
const common = require('@constants/common')
const config = require('@consumption/config')

let consumptionService = null

if (config.consumptionServiceType !== common.CONSUMPTION_SERVICE_SELF) {
	if (config.consumptionServiceType === common.ELEVATE) {
		consumptionService = require('./elevate') // Adjust path/alias as needed
	} else if (config.consumptionServiceType === common.SUNBIRD) {
		consumptionService = require('./sunbird') // Adjust path/alias as needed
	}
}

module.exports = {
	consumptionService,
}

/**
 * name : index.js.
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : Health check Root file.
 */

let healthCheckService = require('./health-check')

module.exports = function (app) {
	app.get('/healthCheckStatus', healthCheckService.healthCheckStatus)
	app.get('/health', healthCheckService.health_check)
}

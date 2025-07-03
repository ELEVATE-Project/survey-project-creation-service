/**
 * name : index.js.
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : Health check Root file.
 */

const healthCheckService = require('./health-check')

module.exports = function (app) {
	app.get('/scp/health', async (req, res) => {
		try {
			await healthCheckService.health_check(req, res)
		} catch (err) {
			console.error('Health check failed:', err.message || err)
			res.status(500).json({ healthy: false, message: err.message || 'Internal Server Error' })
		}
	})

	app.get('/healthCheckStatus', async (req, res) => {
		try {
			await healthCheckService.healthCheckStatus(req, res)
		} catch (err) {
			console.error('HealthCheckStatus failed:', err.message || err)
			res.status(500).json({ healthy: false, message: err.message || 'Internal Server Error' })
		}
	})
}

# Health Check Configuration Guide

This project uses the `elevate-project-services-health-check` package to perform health checks for internal components like MongoDB, Kafka, and dependent microservices.

To enable this, create a configuration file (`health.config.js`) that defines what to check and how.

---

## ✅ Sample Configuration

```js
module.exports = {
	name: 'ProjectService', // 🔹 Service name shown in health check response
	version: '1.0.0', // 🔹 Service version shown in response

	checks: {
		postgres: {
			enabled: true, // ✅ Required if postgres is used
			url: process.env.DEV_DATABASE_URL, // 🔐 Recommended: use env variable
		},
		redis: {
			enabled: true, // ✅ Required if Gotenberg is used
			url: process.env.REDIS_URL, // 🔐 Recommended: use env variable
		},
		kafka: {
			enabled: true, // ✅ Required if Kafka is used
			url: process.env.KAFKA_URL,
		},

		microservices: [
			{
				name: 'SurveyService', // ✅ Required: Unique name
				url: `${process.env.INTERFACE_SERVICE_URL}/survey/health?serviceName=${process.env.SERVICE_NAME}`, // ✅ Required: Health check endpoint
				enabled: true, // ✅ Required: Set to true to activate

				// 🧾 Optional - If the service needs headers/body/method
				request: {
					method: 'GET', // 🔄 HTTP method (GET or POST)
					header: {},
					body: {}, // 🧾 Only needed for POST requests
				},

				// ✅ Required - Define expected keys in response to verify health
				expectedResponse: {
					status: 200, // HTTP status code to expect
					'params.status': 'successful', // ✅ Deep keys allowed
					'result.healthy': true, // ✅ Result if True
				},
			},
			{
				name: 'EntityManagementService', // ✅ Required: Unique name
				url: `${process.env.INTERFACE_SERVICE_URL}/entity/health?serviceName=${process.env.SERVICE_NAME}`, // ✅ Required: Health check endpoint
				enabled: true, // ✅ Required: Set to true to activate
				request: {
					method: 'GET', // 🔄 HTTP method (GET or POST)
					header: {},
					body: {}, //🧾 Only needed for POST requests
				},

				expectedResponse: {
					status: 200, // HTTP status code to expect
					'params.status': 'successful', // ✅ Deep keys allowed
					'result.healthy': true, // ✅ Result if True
				},
			},
			{
				name: 'UserService',
				url: `${process.env.USER_SERVICE_URL}/user/health?serviceName=${process.env.SERVICE_NAME}`,
				enabled: true,
				request: {
					method: 'GET',
					header: {},
					body: {},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
					'result.healthy': true,
				},
			},
			{
				name: 'ProjectService', // ✅ Required: Unique name
				url: `${process.env.INTERFACE_SERVICE_URL}/project/health?serviceName=${process.env.SERVICE_NAME}`, // ✅ Required: Health check endpoint
				enabled: true, // ✅ Required: Set to true to activate

				// 🧾 Optional - If the service needs headers/body/method
				request: {
					method: 'GET', // 🔄 HTTP method (GET or POST)
					header: {},
					body: {}, // 🧾 Only needed for POST requests
				},

				// ✅ Required - Define expected keys in response to verify health
				expectedResponse: {
					status: 200, // HTTP status code to expect
					'params.status': 'successful', // ✅ Deep keys allowed
					'result.healthy': true, // ✅ Result if True
				},
			},
		],
	},
}
```

/**
 * name : health.config.js.
 * author : Mallanagouda R Biradar
 * created-date : 30-Jun-2025
 * Description : Health check config file
 */

module.exports = {
	name: process.env.SERVICE_NAME,
	version: '1.0.0',
	checks: {
		kafka: {
			enabled: true,
			url: process.env.KAFKA_URL,
		},
		postgres: {
			enabled: true,
			url: process.env.DEV_DATABASE_URL,
		},
		redis: {
			enabled: true,
			url: process.env.REDIS_HOST,
		},
		microservices: [
			{
				name: 'EntityManagementService',
				url: `${process.env.INTERFACE_SERVICE_HOST}/entity/health?serviceName=${process.env.SERVICE_NAME}`,
				enabled: true,
				request: {
					method: 'GET',
					header: {},
					body: {},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
				},
			},
			{
				name: 'ProjectService',
				url: `${process.env.INTERFACE_SERVICE_HOST}/project/health?serviceName=${process.env.SERVICE_NAME}`,
				enabled: true,
				request: {
					method: 'GET',
					header: {},
					body: {},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
				},
			},
			{
				name: 'UserService',
				url: `${process.env.USER_SERVICE_HOST}/user/health?serviceName=${process.env.SERVICE_NAME}`,
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
				name: 'SamikshaService',
				url: `${process.env.INTERFACE_SERVICE_HOST}/survey/health?serviceName=${process.env.SERVICE_NAME}`,
				enabled: true,
				request: {
					method: 'GET',
					header: {},
					body: {
						'service Name': 'Project Service',
					},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
					'result.healthy': true,
				},
			},
		],
	},
}

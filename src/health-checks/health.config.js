/**
 * name : health.config.js.
 * author : Mallanagouda R Biradar
 * created-date : 30-Jun-2025
 * Description : Health check config file
 */

module.exports = {
	name: 'SCP',
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
				url: 'http://localhost:3569/entity/health?serviceName=SCP', // Replace with actual URL - use environment variable if needed
				enabled: true,

				request: {
					method: 'GET',
					header: {
						'internal-access-token': process.env.INTERNAL_TOKEN,
					},
					body: {},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
				},
			},
			{
				name: 'ProjectService',
				url: 'http://localhost:3569/project/health?serviceName=SCP', // Replace with actual URL - use environment variable if needed
				enabled: true,

				request: {
					method: 'GET',
					header: {
						'internal-access-token': process.env.INTERNAL_TOKEN,
					},
					body: {},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
				},
			},
			{
				name: 'UserService',
				url: 'http://localhost:3569/user/health?serviceName=SCP', // Replace with actual URL - use environment variable if needed
				enabled: true,
				request: {
					method: 'GET',
					header: {
						'internal-access-token': process.env.INTERNAL_TOKEN,
					},
					body: {},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
				},
			},
			{
				name: 'SamikshaService',
				url: 'http://localhost:3569/survey/health?serviceName=SCP',
				enabled: true,
				request: {
					method: 'GET',
					header: {
						'internal-access-token': process.env.INTERNAL_TOKEN,
					},
					body: {
						'service Name': 'Project Service',
					},
				},

				expectedResponse: {
					status: 200,
					'params.status': 'successful',
				},
			},
		],
	},
}

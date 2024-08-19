'use strict'
const events = require('@constants/eventEndpoints')
const requester = require('@helpers/requester')
const common = require('@constants/common')

exports.eventBroadcaster = async (
	action,
	{
		requestBody = {},
		headers = { internal_access_token: process.env.INTERNAL_ACCESS_TOKEN },
		pathParams = {},
		queryParams = {},
	}
) => {
	try {
		const endPoints = events.eventEndpoints[action]
		await Promise.all(
			endPoints.map((endPoint) => {
				if (endPoint.type === common.EVENT_TYPE_API) {
					if (endPoint.method === 'POST')
						requester.post(endPoint.baseUrl, endPoint.route, headers, requestBody, queryParams)
					else if (endPoints.method === 'GET')
						requester.get(endPoint.baseUrl, endPoint.route, headers, pathParams, queryParams)
				} else if (endPoint.type === common.EVENT_TYPE_FUNCTION) {
					const params = endPoint.functionParams(requestBody)
					endPoint.functionName(...params)
				}
			})
		)
	} catch (err) {
		console.error('EventBroadcaster Error:', err)
	}
}

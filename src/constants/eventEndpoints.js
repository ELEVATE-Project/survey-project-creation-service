const common = require('@constants/common')
const activityService = require('@services/activities')
module.exports = {
	eventEndpoints: {
		addUserAction: [
			{
				type: common.EVENT_TYPE_FUNCTION,
				functionName: activityService.addUserAction,
				functionParams: (requestBody) => [
					requestBody.action_name,
					requestBody.user_id,
					requestBody.object_id,
					requestBody.object_type,
					requestBody.organization_id,
				],
			},
		],
	},
}

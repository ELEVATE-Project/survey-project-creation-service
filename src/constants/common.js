/**
 * name : constants/common.js
 * author : Adithya Dinesh
 * Date : 29 - April - 2024
 * Description : All commonly used constants through out the service
 */

function getPaginationOffset(page, limit) {
	return (page - 1) * limit
}

module.exports = {
	pagination: {
		DEFAULT_PAGE_NO: 1,
		DEFAULT_PAGE_SIZE: 100,
	},
	getPaginationOffset,
	AUTH_METHOD: {
		JWT_ONLY: 'jwt_only',
		USER_SERVICE: 'user_service_authenticated',
	},
	internalAccessUrls: [],
	SCP_SERVICE: 'scp',
	REVIEW_TYPE_SEQUENTIAL: 'sequential',
	REVIEW_TYPE_PARALLEL: 'parallel',
	RESOURCES: 'resources',
	INSTANCE_LEVEL_CONFIG_ATTRIBUTES: [
		'review_required',
		'show_reviewer_list',
		'min_approval',
		'resource_type',
		'review_type',
	],
	MIN_APPROVAL: 1,
}

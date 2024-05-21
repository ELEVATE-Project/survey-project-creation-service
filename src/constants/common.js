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
	CONTENT_CREATOR: 'content_creator',
	REVIEWER: 'reviewer',
	RESOURCE_CREATOR: 'resource_creator',
	ADMIN_ROLE: 'admin',
	ORG_ADMIN_ROLE: 'org_admin',
}

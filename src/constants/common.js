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
	WRITE_ACCESS: 'w',
	READ_ACCESS: 'r',
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
	CONTENT_CREATOR: 'content_creator',
	REVIEWER: 'reviewer',
	RESOURCE_CREATOR: 'resource_creator',
	ADMIN_ROLE: 'admin',
	ORG_ADMIN_ROLE: 'org_admin',
	PROJECT: 'project',
	CERTIFICATE_PATH: 'certificate/',
	LOGO_PATH: 'certificate_logo/',
	SIGNATURE_PATH: 'certfile_signature/',
	BASETEMPLATE_PATH: 'certfile_basetemplate/',
	PROJECT_PATH: 'project/',
	BASETEMPLATE: 'baseTemplate',
	SIGNATURE: 'signature',
	LOGO: 'logo',
	CERTIFICATE: 'certificate',
	NO_OF_MINUTES: 30,
	NO_OF_EXPIRY_TIME: 60,
}
